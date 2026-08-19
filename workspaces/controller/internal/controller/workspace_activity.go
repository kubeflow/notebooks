/*
Copyright 2024.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package controller

import (
	"context"
	"fmt"
	"maps"
	"time"

	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

const (
	// defaultJupyterProbeTimeout bounds a single Jupyter probe HTTP request.
	defaultJupyterProbeTimeout = 10 * time.Second
)

// reconcileActivity runs the activity probe (if due), evaluates the activityRules, updates
// the Workspace activity status, and decides whether the Workspace should be paused for inactivity.
//
// It returns:
//   - a reconcile result carrying the requeue duration for the next probe attempt
//   - a bool indicating whether the caller should pause the Workspace (set `spec.paused = true`)
//   - an error, only for unexpected failures (probe failures are NOT returned as errors)
//
// This function mutates `workspace.Status.Activity` in place. It only sets `spec.paused` on the
// in-memory object; the caller is responsible for persisting the spec change.
//
// ACTIVITY GRANULARITY / TIMING CAVEAT:
//
//	A Workspace is only ever paused immediately after a fresh, successful probe confirms it is
//	still inactive (see evaluatePauseDecision's allowPause parameter). We deliberately do NOT
//	pause based on the last known activity data in between probes, because the user may have
//	resumed activity since the last probe. As a consequence, activity rules are only evaluated at probe
//	time, so the effective pause latency is bounded by `probeIntervalSeconds`:
//
//	  - a Workspace may keep running for up to ~probeIntervalSeconds AFTER it first becomes
//	    eligible (i.e. after lastActivity + secondsSinceActive) before it is actually paused.
//
//	This is an intentional trade-off: it guarantees we never pause an actively-used Workspace
//	based on stale activity data, at the cost of coarser timing. Operators who want
//	tighter timing should lower `probeIntervalSeconds` (bearing in mind this increases the
//	probe load on Workspaces and the API server).
func (r *WorkspaceReconciler) reconcileActivity(
	ctx context.Context,
	log logr.Logger,
	workspace *kubefloworgv1beta1.Workspace,
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	currentImageConfig *kubefloworgv1beta1.ImageConfigValue,
	currentPodConfig *kubefloworgv1beta1.PodConfigValue,
	pod *corev1.Pod,
) (ctrl.Result, bool, error) {

	activityProbe := workspaceKind.Spec.PodTemplate.ActivityProbe

	// activity handling is only relevant when an activityProbe is configured.
	if activityProbe == nil {
		return ctrl.Result{}, false, nil
	}

	// only Running Workspaces are probed.
	//  - Paused/Pending/Terminating/Error Workspaces are never probed or paused here.
	if workspace.Status.State != kubefloworgv1beta1.WorkspaceStateRunning {
		return ctrl.Result{}, false, nil
	}

	now := metav1.Now().UnixMilli()

	minProbeInterval := time.Duration(ptr.Deref(activityProbe.MinProbeIntervalSeconds, kubefloworgv1beta1.DefaultMinProbeIntervalSeconds)) * time.Second
	probeInterval := time.Duration(ptr.Deref(activityProbe.ProbeIntervalSeconds, kubefloworgv1beta1.DefaultProbeIntervalSeconds)) * time.Second

	// gather the labels used by activity rule matching.
	namespaceLabels, err := r.getNamespaceLabels(ctx, workspace.Namespace)
	if err != nil {
		log.Error(err, "unable to fetch namespace labels for activity rule matching")
		return ctrl.Result{}, false, err
	}
	podConfigLabels := helper.PodConfigLabelsToMap(currentPodConfig)

	// if a probe is not yet due, refresh the `eligibleAfter` status (for the UI) using the
	// existing activity data and requeue for when the next probe is due.
	//  - we pass allowPause=false here: the activity data may be stale (no probe ran this
	//    reconcile), so we must NOT pause based on it. A Workspace is only ever paused right
	//    after a fresh probe confirms it is still inactive. This prevents pausing a Workspace
	//    whose user has resumed activity since the last probe but before the next probe is due.
	if remaining, due := timeUntilProbeDue(workspace, now, minProbeInterval, probeInterval); !due {
		if _, err := evaluatePauseDecision(workspace, workspaceKind, namespaceLabels, podConfigLabels, now, false); err != nil {
			log.Error(err, "unable to evaluate activity rules")
			return ctrl.Result{}, false, err
		}
		return ctrl.Result{RequeueAfter: remaining}, false, nil
	}

	// execute the probe and update the activity status from its result.
	probeResult := r.runProbe(ctx, workspace, activityProbe, currentImageConfig, pod)
	updateActivityStatusFromProbe(workspace, probeResult)

	// evaluate rules and decide whether to pause.
	//  - allowPause is gated on a successful probe: a Workspace is only paused when a fresh,
	//    successful probe confirms inactivity. A failed probe never triggers a pause.
	paused, err := evaluatePauseDecision(workspace, workspaceKind, namespaceLabels, podConfigLabels, now, probeResult.Succeeded())
	if err != nil {
		log.Error(err, "unable to evaluate activity rules")
		return ctrl.Result{}, false, err
	}

	// schedule the next probe:
	//  - success  -> probeInterval (ensures fresh UI data)
	//  - failure  -> minProbeInterval (retry, but rate-limited)
	nextInterval := probeInterval
	if !probeResult.Succeeded() {
		nextInterval = minProbeInterval
	}

	return ctrl.Result{RequeueAfter: nextInterval}, paused, nil
}

// timeUntilProbeDue reports whether a probe is currently due for the Workspace, and if not, how
// long until the next probe should run.
//
// A probe is due when both minProbeInterval and probeInterval have elapsed since the last probe
// started. When no probe has run yet, a probe is immediately due. The returned duration is only
// meaningful when due is false.
func timeUntilProbeDue(workspace *kubefloworgv1beta1.Workspace, now int64, minProbeInterval, probeInterval time.Duration) (remaining time.Duration, due bool) {
	if workspace.Status.Activity.LastProbe == nil {
		return 0, true
	}
	lastProbe := workspace.Status.Activity.LastProbe
	lastProbeStart := lastProbe.StartTime
	if lastProbeStart <= 0 {
		return 0, true
	}

	elapsed := time.Duration(now-lastProbeStart) * time.Millisecond

	// minProbeInterval rate-limits all probes (including failing ones); probeInterval ensures
	// we probe at least this frequently.
	requiredInterval := minProbeInterval
	if lastProbe.Result == kubefloworgv1beta1.WorkspaceProbeResultSuccess {
		requiredInterval = probeInterval
	}

	if elapsed < requiredInterval {
		return requiredInterval - elapsed, false
	}
	return 0, true
}

// runProbe dispatches to the configured probe implementation (Jupyter or podExec).
func (r *WorkspaceReconciler) runProbe(
	ctx context.Context,
	workspace *kubefloworgv1beta1.Workspace,
	activityProbe *kubefloworgv1beta1.ActivityProbe,
	currentImageConfig *kubefloworgv1beta1.ImageConfigValue,
	pod *corev1.Pod,
) *helper.ProbeResult {

	now := time.Now()

	// the Pod must exist and have an IP to be probed.
	if pod == nil || pod.Status.PodIP == "" {
		return &helper.ProbeResult{
			StartTime: now,
			EndTime:   now,
			Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
			Message:   helper.ProbeMessagePodNotReady,
		}
	}

	switch {
	case activityProbe.Jupyter != nil:
		port, ok := imageConfigPortForID(currentImageConfig, activityProbe.Jupyter.PortId)
		if !ok {
			return &helper.ProbeResult{
				StartTime: now,
				EndTime:   now,
				Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
				Message:   fmt.Sprintf("%sport %q not found in imageConfig", helper.ProbeMessagePrefixJupyterFailed, activityProbe.Jupyter.PortId),
			}
		}
		if r.HTTPProber == nil {
			return &helper.ProbeResult{
				StartTime: now,
				EndTime:   now,
				Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
				Message:   helper.ProbeMessagePrefixJupyterFailed + "http prober is not configured",
			}
		}
		basePath := getWorkspaceConnectPath(workspace.Namespace, workspace.Name, activityProbe.Jupyter.PortId)
		return helper.RunJupyterProbe(ctx, r.HTTPProber, pod.Status.PodIP, port, basePath, defaultJupyterProbeTimeout)

	case activityProbe.PodExec != nil:
		if r.PodExecutor == nil {
			return &helper.ProbeResult{
				StartTime: now,
				EndTime:   now,
				Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
				Message:   helper.ProbeMessagePrefixPodExecFailed + "exec is not configured",
			}
		}
		timeout := time.Duration(ptr.Deref(activityProbe.PodExec.TimeoutSeconds, kubefloworgv1beta1.DefaultPodExecTimeoutSeconds)) * time.Second
		return helper.RunPodExecProbe(ctx, r.PodExecutor, pod.Namespace, pod.Name, activityProbe.PodExec.Script, timeout)

	default:
		return &helper.ProbeResult{
			StartTime: now,
			EndTime:   now,
			Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
			Message:   helper.ProbeMessageNoTypeConfigured,
		}
	}
}

// updateActivityStatusFromProbe applies a probe result to the Workspace activity status.
//   - on success, `lastActivity` (if the probe returned one) and `lastUpdate` are advanced
//   - on failure, `lastActivity` and `lastUpdate` are preserved (never regressed)
func updateActivityStatusFromProbe(workspace *kubefloworgv1beta1.Workspace, result *helper.ProbeResult) {
	workspace.Status.Activity.LastProbe = &kubefloworgv1beta1.WorkspaceActivityLastProbe{
		StartTime: result.StartTime.UnixMilli(),
		EndTime:   result.EndTime.UnixMilli(),
		Result:    result.Result,
		Message:   result.Message,
	}

	if result.Succeeded() {
		if result.LastActivity != nil {
			workspace.Status.Activity.LastActivity = result.LastActivity.UnixMilli()
		}
		workspace.Status.Activity.LastUpdate = result.EndTime.UnixMilli()
	}
}

// evaluatePauseDecision evaluates the activityRules against the Workspace and updates the
// `status.activity.rules.pauseWorkspace.eligibleAfter` field. It returns true when the Workspace
// should be paused.
//
// allowPause gates whether an eligible Workspace is actually paused:
//   - when true (called immediately after a fresh probe), an eligible Workspace is paused.
//   - when false (called when a probe is NOT due), the `eligibleAfter` status is still refreshed
//     for the UI, but the Workspace is never paused. This is critical: pausing MUST be backed by
//     a fresh probe in the same reconcile, otherwise a Workspace could be paused based on a stale
//     `lastActivity` even though the user resumed activity since the last probe.
//
// namespaceLabels and podConfigLabels are the labels used for rule matching.
func evaluatePauseDecision(
	workspace *kubefloworgv1beta1.Workspace,
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	namespaceLabels, podConfigLabels map[string]string,
	now int64,
	allowPause bool,
) (bool, error) {

	rules := workspaceKind.Spec.ActivityRules
	if len(rules) == 0 {
		if workspace.Status.Activity.Rules != nil {
			workspace.Status.Activity.Rules.PauseWorkspace = nil
		}
		return false, nil
	}

	decision, err := helper.EvaluatePauseWorkspaceRule(rules, namespaceLabels, podConfigLabels)
	if err != nil {
		return false, err
	}
	// if no matched rule or pauseWorkspace is false, clear the status to avoid misleading the user.
	if !decision.Matched || !decision.Value {
		if workspace.Status.Activity.Rules != nil {
			workspace.Status.Activity.Rules.PauseWorkspace = nil
		}
		return false, nil
	}

	eligible, eligibleAfter := helper.IsEligibleForPause(
		workspace.Status.Activity.LastActivity,
		workspace.Status.LastRunningTime,
		now,
		decision.SecondsSinceActive,
		decision.MinRunningSeconds,
	)

	if workspace.Status.Activity.Rules == nil {
		workspace.Status.Activity.Rules = &kubefloworgv1beta1.WorkspaceActivityRules{}
	}
	workspace.Status.Activity.Rules.PauseWorkspace = &kubefloworgv1beta1.WorkspaceActivityPauseRule{
		EligibleAfter: eligibleAfter,
	}

	// only pause when the matched rule opts in, the Workspace is eligible, AND the decision is
	// backed by a fresh probe in this reconcile (allowPause).
	//  - a failing probe leaves lastActivity unchanged, so eligibility is based on the
	//    last known-good activity (never paused purely because a probe failed)
	//  - when allowPause is false the activity data may be stale (no probe ran this reconcile),
	//    so we must NOT pause even if the stale data says the Workspace is eligible
	if eligible && allowPause {
		return true, nil
	}

	return false, nil
}

// getNamespaceLabels returns the labels of the given namespace.
// It always returns a non-nil map (empty when the namespace is missing or has no labels).
func (r *WorkspaceReconciler) getNamespaceLabels(ctx context.Context, namespaceName string) (map[string]string, error) {
	ns := &corev1.Namespace{}
	if err := r.Get(ctx, client.ObjectKey{Name: namespaceName}, ns); err != nil {
		if apierrors.IsNotFound(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	result := make(map[string]string, len(ns.Labels))
	maps.Copy(result, ns.Labels)
	return result, nil
}

// imageConfigPortForID resolves the container port number for a given WorkspaceKind port id by
// matching against the imageConfig ports (which carry both the port id and the port number).
func imageConfigPortForID(imageConfig *kubefloworgv1beta1.ImageConfigValue, portID kubefloworgv1beta1.PortId) (int32, bool) {
	if imageConfig == nil {
		return 0, false
	}
	for _, p := range imageConfig.Spec.Ports {
		if p.Id == portID {
			return p.Port, true
		}
	}
	return 0, false
}
