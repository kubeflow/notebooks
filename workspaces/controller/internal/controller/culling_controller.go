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
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/go-logr/logr"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/httpstream"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/utils/ptr"
	"net"
	"net/http"
	"net/url"
	"os"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"strconv"
	"strings"
	"time"
)

const (
	defaultClusterDomain             = "cluster.local"
	inactivityToleranceBufferSeconds = 5
	defaultHTTPTimeout               = 15 * time.Second
)

// CullingReconciler reconciles a Workspace object
type CullingReconciler struct {
	client.Client
	Scheme    *runtime.Scheme
	ClientSet *kubernetes.Clientset
	Config    *rest.Config
}

type ActivityProbe struct {
	HasActivity  *bool   `json:"has_activity,omitempty"`
	LastActivity *string `json:"last_activity,omitempty"`
}

func (r *CullingReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) { // nolint:gocyclo
	log := log.FromContext(ctx)
	log.V(2).Info("reconciling Workspace for culling")
	// fetch the Workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.Get(ctx, req.NamespacedName, workspace); err != nil {
		if client.IgnoreNotFound(err) == nil {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected.
			// For additional cleanup logic use finalizers.
			// Return and don't requeue.
			return ctrl.Result{}, nil
		}
		log.Error(err, "unable to fetch Workspace")
		return ctrl.Result{}, err
	}
	if !workspace.GetDeletionTimestamp().IsZero() {
		log.V(2).Info("Workspace is being deleted, skipping culling")
		return ctrl.Result{}, nil
	}
	if workspace.Spec.DisableCulling != nil && *workspace.Spec.DisableCulling {
		log.V(2).Info("Culling is disabled for this workspace", "DisableCulling", *workspace.Spec.DisableCulling)
		return ctrl.Result{}, nil
	}

	if *workspace.Spec.Paused {
		log.V(2).Info("Workspace is paused, skipping culling")
		return ctrl.Result{}, nil
	}

	if workspace.Status.State != kubefloworgv1beta1.WorkspaceStateRunning {
		log.V(2).Info("Workspace is not running, skipping culling")
		return ctrl.Result{}, nil
	}

	workspaceKindName := workspace.Spec.Kind
	log = log.WithValues("workspaceKind", workspaceKindName)
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			log.V(0).Info("Workspace references unknown WorkspaceKind")
			return ctrl.Result{}, err
		}
		log.Error(err, "unable to fetch WorkspaceKind for Workspace")
		return ctrl.Result{}, err
	}

	if !*workspaceKind.Spec.PodTemplate.Culling.Enabled {
		log.Info("culling is disabled for this workspace kind")
		return ctrl.Result{}, nil
	}

	// Fetch the last activity, update and probe times from the Workspace status
	lastActivityTime := time.Unix(workspace.Status.Activity.LastActivity, 0)
	lastUpdateTime := time.Unix(workspace.Status.Activity.LastUpdate, 0)
	lastProbeTime := time.Unix(workspace.Status.Activity.LastProbe.EndTimeMs/1000, 0)

	// Fetch the culling configuration from the WorkspaceKind spec
	maxInactiveSeconds := *workspaceKind.Spec.PodTemplate.Culling.MaxInactiveSeconds
	maxProbeIntervalSeconds := *workspaceKind.Spec.PodTemplate.Culling.MaxProbeIntervalSeconds
	minProbeIntervalSeconds := *workspaceKind.Spec.PodTemplate.Culling.MinProbeIntervalSeconds

	// Calculate time since the last activity, the last update and the last probe
	timeSinceLastActivity := time.Since(lastActivityTime).Seconds()
	timeSinceLastUpdate := time.Since(lastUpdateTime).Seconds()
	timeSinceLastProbe := time.Since(lastProbeTime).Seconds()

	// Calculate the requeue time for the next probe
	minRequeueAfter := time.Duration(minProbeIntervalSeconds) * time.Second
	requeueAfter := max(time.Duration(float64(maxProbeIntervalSeconds)-timeSinceLastProbe)*time.Second, minRequeueAfter)
	log.Info("requesting requeue", "requeueAfter", requeueAfter, "minRequeueAfter", minRequeueAfter)
	// if the workspace has been probed recently, requeue for the next probe
	if timeSinceLastProbe < float64(minProbeIntervalSeconds) {
		log.V(2).Info("Workspace has been probed recently, requeueing for the next probe.",
			"MinProbeIntervalSeconds", minProbeIntervalSeconds,
			"TimeSinceLastProbe", timeSinceLastProbe)
		return ctrl.Result{RequeueAfter: requeueAfter}, nil
	}

	// If the workspace has been active recently, requeue for the next probe
	if timeSinceLastActivity < float64(maxInactiveSeconds) {
		log.V(2).Info("Workspace activity is within the allowed period, requeueing for the next probe.",
			"MaxInactiveSeconds", maxInactiveSeconds,
			"TimeSinceLastActivity", timeSinceLastActivity, "requeueAfter", requeueAfter)
		return ctrl.Result{RequeueAfter: requeueAfter}, nil
	}
	// If the workspace was updated recently, requeue for the next probe
	if timeSinceLastUpdate < float64(maxProbeIntervalSeconds) {
		log.V(2).Info("Workspace has been updated recently, requeueing for the next probe.",
			"MinProbeIntervalSeconds", maxProbeIntervalSeconds,
			"TimeSinceLastUpdate", timeSinceLastUpdate)
		return ctrl.Result{RequeueAfter: requeueAfter}, nil
	}

	// Check if JupyterLab API probing is enabled
	if workspaceKind.Spec.PodTemplate.Culling.ActivityProbe.Jupyter != nil {
		probeStartTime := time.Now()
		serviceName, err := r.getServiceName(ctx, workspace)
		if err != nil {
			log.Error(err, "Error fetching service name for workspace")
			return r.updateWorkspaceActivityStatus(ctx, log, workspace, &minRequeueAfter, &kubefloworgv1beta1.ProbeStatus{
				StartTimeMs: probeStartTime.UnixMilli(),
				EndTimeMs:   time.Now().UnixMilli(),
				Result:      kubefloworgv1beta1.ProbeResultFailure,
				Message:     "Failed to fetch service name for workspace",
			}, nil, nil)
		}
		port := "8888"
		jupyterAPIEndpoint := fmt.Sprintf("http://%s.%s.svc.%s:%s/workspace/%s/%s/jupyterlab/api/status", serviceName, workspace.Namespace, defaultClusterDomain, port, workspace.Namespace, workspace.Name)

		lastActivity, err, probeMessage, probeResult := fetchLastActivityFromJupyterAPI(jupyterAPIEndpoint)
		if err != nil {
			log.Error(err, "Error fetching last activity from JupyterLab API")
			return r.updateWorkspaceActivityStatus(ctx, log, workspace, &minRequeueAfter, &kubefloworgv1beta1.ProbeStatus{
				StartTimeMs: probeStartTime.UnixMilli(),
				EndTimeMs:   time.Now().UnixMilli(),
				Result:      probeResult,
				Message:     probeMessage,
			}, nil, nil)
		}

		// If the workspace has been inactive for too long, initiate culling
		if time.Since(*lastActivity).Seconds() > float64(maxInactiveSeconds+inactivityToleranceBufferSeconds) {
			log.V(2).Info("Culling the workspace due to inactivity", "TimeSinceLastActivity", time.Since(*lastActivity).Seconds())
			workspace.Spec.Paused = ptr.To(true)
			err := r.Update(ctx, workspace)
			if err != nil {
				log.Error(err, "Error updating workspace during culling")
				return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
					StartTimeMs: probeStartTime.UnixMilli(),
					EndTimeMs:   time.Now().UnixMilli(),
					Result:      kubefloworgv1beta1.ProbeResultFailure,
					Message:     "Failed to pause workspace",
				}, nil, nil)
			}
		}
		return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
			StartTimeMs: probeStartTime.UnixMilli(),
			EndTimeMs:   time.Now().UnixMilli(),
			Result:      probeResult,
			Message:     probeMessage,
		}, ptr.To(probeStartTime.Unix()), ptr.To(lastActivity.Unix()))
	}

	if workspaceKind.Spec.PodTemplate.Culling.ActivityProbe.Exec != nil {
		probeStartTime := time.Now()
		podName, err := r.getPodName(ctx, workspace)
		if err != nil {
			log.Error(err, "Error fetching pod name for workspace")
			return r.updateWorkspaceActivityStatus(ctx, log, workspace, &minRequeueAfter, &kubefloworgv1beta1.ProbeStatus{
				StartTimeMs: probeStartTime.UnixMilli(),
				EndTimeMs:   time.Now().UnixMilli(),
				Result:      kubefloworgv1beta1.ProbeResultFailure,
				Message:     "Failed to fetch pod name for workspace",
			}, nil, nil)
		}
		stdout, stderr, err := r.execCommand(ctx, podName, workspace.Namespace, workspaceKind.Spec.PodTemplate.Culling.ActivityProbe.Exec)
		if err != nil {
			log.Error(err, "Error executing command probe", "stderr", stderr)
			return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
				StartTimeMs: probeStartTime.UnixMilli(),
				EndTimeMs:   time.Now().UnixMilli(),
				Result:      kubefloworgv1beta1.ProbeResultFailure,
				Message:     "Failed to execute command probe",
			}, nil, nil)

		}

		// handle the probe result
		activityProbe, err := parseActivityProbeJson(stdout)
		if err != nil {
			log.Error(err, "Error parsing activity probe JSON")
			return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
				StartTimeMs: probeStartTime.UnixMilli(),
				EndTimeMs:   time.Now().UnixMilli(),
				Result:      kubefloworgv1beta1.ProbeResultFailure,
				Message:     "Failed to parse activity probe JSON",
			}, nil, nil)
		}
		lastActivity := time.Now().Unix()
		if activityProbe.HasActivity != nil && !*activityProbe.HasActivity {
			log.V(2).Info("Culling the workspace due to inactivity")
			//TODO: figure out how to set the last activity time
			lastActivity = time.Now().Unix()
			workspace.Spec.Paused = ptr.To(true)
			err := r.Update(ctx, workspace)
			if err != nil {
				log.Error(err, "Error updating workspace during culling")
				return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
					StartTimeMs: probeStartTime.UnixMilli(),
					EndTimeMs:   time.Now().UnixMilli(),
					Result:      kubefloworgv1beta1.ProbeResultFailure,
					Message:     "Failed to update workspace during culling",
				}, nil, nil)
			}

		}
		if activityProbe.HasActivity == nil && activityProbe.LastActivity != nil {
			lastActivityTime, err = time.Parse(time.RFC3339, *activityProbe.LastActivity)
			if err != nil {
				log.Error(err, "Error parsing last activity time")
				return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
					StartTimeMs: probeStartTime.UnixMilli(),
					EndTimeMs:   time.Now().UnixMilli(),
					Result:      kubefloworgv1beta1.ProbeResultFailure,
					Message:     "Failed to parse last activity time",
				}, nil, nil)
			}
			lastActivity = lastActivityTime.Unix()
			if time.Since(lastActivityTime).Seconds() > float64(maxInactiveSeconds+inactivityToleranceBufferSeconds) {
				log.V(2).Info("Culling the workspace due to inactivity", "TimeSinceLastActivity", time.Since(lastActivityTime).Seconds())
				workspace.Spec.Paused = ptr.To(true)
				err := r.Update(ctx, workspace)
				if err != nil {
					log.Error(err, "Error updating workspace during culling")
					return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
						StartTimeMs: probeStartTime.UnixMilli(),
						EndTimeMs:   time.Now().UnixMilli(),
						Result:      kubefloworgv1beta1.ProbeResultFailure,
						Message:     "Failed to update workspace during culling",
					}, nil, nil)
				}
			}
		}
		return r.updateWorkspaceActivityStatus(ctx, log, workspace, &requeueAfter, &kubefloworgv1beta1.ProbeStatus{
			StartTimeMs: probeStartTime.UnixMilli(),
			EndTimeMs:   time.Now().UnixMilli(),
			Result:      kubefloworgv1beta1.ProbeResultSuccess,
			Message:     "Bash probe succeeded",
		}, ptr.To(probeStartTime.Unix()), ptr.To(lastActivity))
	}

	log.Info("culling controller finished")
	return ctrl.Result{RequeueAfter: requeueAfter}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *CullingReconciler) SetupWithManager(mgr ctrl.Manager) error {

	return ctrl.NewControllerManagedBy(mgr).
		For(&kubefloworgv1beta1.Workspace{}).
		Complete(r)
}

// updateWorkspaceActivityStatus attempts to immediately update the Workspace activity status with the provided status.
func (r *CullingReconciler) updateWorkspaceActivityStatus(ctx context.Context, log logr.Logger, workspace *kubefloworgv1beta1.Workspace, requeueAfter *time.Duration, probeStatus *kubefloworgv1beta1.ProbeStatus, lastUpdate, lastActivity *int64) (ctrl.Result, error) { // nolint:unparam
	if workspace == nil {
		return ctrl.Result{}, fmt.Errorf("provided Workspace was nil")
	}
	if lastUpdate != nil {
		workspace.Status.Activity.LastUpdate = *lastUpdate
	}
	if lastActivity != nil {
		workspace.Status.Activity.LastActivity = *lastActivity
	}
	if probeStatus != nil {
		workspace.Status.Activity.LastProbe = *probeStatus
	}
	if err := r.Status().Update(ctx, workspace); err != nil {
		if apierrors.IsConflict(err) {
			log.V(2).Info("update conflict while updating Workspace status, will requeue")
			return ctrl.Result{Requeue: true}, nil
		}
		log.Error(err, "unable to update Workspace status")
		return ctrl.Result{}, err
	}
	if requeueAfter != nil {
		return ctrl.Result{RequeueAfter: *requeueAfter}, nil
	}

	return ctrl.Result{}, nil
}

func (r *CullingReconciler) getServiceName(ctx context.Context, workspace *kubefloworgv1beta1.Workspace) (string, error) {
	ownedServices := &corev1.ServiceList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceOwnerField, workspace.Name),
		Namespace:     workspace.Namespace,
	}

	// List services owned by the workspace
	if err := r.List(ctx, ownedServices, listOpts); err != nil {
		return "", err
	}

	// Check the number of owned services
	if len(ownedServices.Items) > 1 {
		serviceList := make([]string, len(ownedServices.Items))
		for i, svc := range ownedServices.Items {
			serviceList[i] = svc.Name
		}
		serviceListString := strings.Join(serviceList, ", ")
		return "", fmt.Errorf("workspace owns multiple Services: %s", serviceListString)

	} else if len(ownedServices.Items) == 0 {
		return "", errors.New("workspace does not own any Service")
	}

	// Return the single found service name
	return ownedServices.Items[0].Name, nil
}

func (r *CullingReconciler) getPodName(ctx context.Context, workspace *kubefloworgv1beta1.Workspace) (string, error) {
	var statefulSetName string
	ownedStatefulSets := &appsv1.StatefulSetList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceOwnerField, workspace.Name),
		Namespace:     workspace.Namespace,
	}
	if err := r.List(ctx, ownedStatefulSets, listOpts); err != nil {
		return "", err
	}

	// reconcile StatefulSet
	if len(ownedStatefulSets.Items) > 1 {
		statefulSetList := make([]string, len(ownedStatefulSets.Items))
		for i, sts := range ownedStatefulSets.Items {
			statefulSetList[i] = sts.Name
		}
		statefulSetListString := strings.Join(statefulSetList, ", ")
		return "", fmt.Errorf("workspace owns multiple StatefulSets: %s", statefulSetListString)
	} else if len(ownedStatefulSets.Items) == 0 {
		return "", errors.New("workspace does not own any StatefulSet")
	}

	statefulSetName = ownedStatefulSets.Items[0].Name
	podName := fmt.Sprintf("%s-0", statefulSetName)
	return podName, nil
}

func (r *CullingReconciler) execCommand(ctx context.Context, podName, podNamespace string, exec *kubefloworgv1beta1.ActivityProbeExec) (string, string, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(exec.TimeoutSeconds)*time.Second)
	defer cancel()

	command := fmt.Sprintf(`
        rm -f %s
        %s
        cat %s
    `, exec.OutputPath, exec.Script, exec.OutputPath)

	req := r.ClientSet.CoreV1().RESTClient().
		Post().
		Resource("pods").
		Name(podName).
		Namespace(podNamespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "main",
			Command:   []string{"bash", "-c", command},
			Stdin:     false,
			Stdout:    true,
			Stderr:    true,
			TTY:       false,
		}, scheme.ParameterCodec)

	executor, err := createExecutor(req.URL(), r.Config)
	if err != nil {
		return "", "", fmt.Errorf("error creating executor: %v", err)
	}

	var stdout, stderr bytes.Buffer
	err = executor.StreamWithContext(timeoutCtx, remotecommand.StreamOptions{
		Stdin:  nil,
		Stdout: &stdout,
		Stderr: &stderr,
		Tty:    false,
	})

	return stdout.String(), stderr.String(), err
}

// fetchLastActivityFromJupyterAPI queries the JupyterLab API for the last activity time.
func fetchLastActivityFromJupyterAPI(apiEndpoint string) (*time.Time, error, string, kubefloworgv1beta1.ProbeResult) {
	httpTimeoutSeconds := defaultHTTPTimeout
	if timeout, err := strconv.Atoi(os.Getenv("HTTP_TIMEOUT_SECONDS")); err == nil && timeout > 0 {
		httpTimeoutSeconds = time.Duration(timeout) * time.Second
	}
	httpClient := &http.Client{Timeout: httpTimeoutSeconds}
	resp, err := httpClient.Get(apiEndpoint)
	var netErr net.Error
	if err != nil {
		if errors.As(err, &netErr) && netErr.Timeout() {
			return nil, fmt.Errorf("JupyterLab API request timed out: %w", err),
				"JupyterLab API request timeout", kubefloworgv1beta1.ProbeResultTimeout
		} else {
			return nil, fmt.Errorf("JupyterLab API request failed: %w", err),
				"Jupyter probe failed", kubefloworgv1beta1.ProbeResultFailure
		}
	}
	// Check if the API returned a 200-OK status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JupyterLab API returned non-200 status: %d", resp.StatusCode),
			fmt.Sprintf("Jupyter probe failed: HTTP %d", resp.StatusCode), kubefloworgv1beta1.ProbeResultFailure
	}

	// Decode the API response to extract the last activity time
	var status struct {
		LastActivity string `json:"last_activity"`
	}

	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("failed to parse JupyterLab API response: %w", err),
			"Jupyter probe failed: invalid response body", kubefloworgv1beta1.ProbeResultFailure
	}

	// Parse the last activity time from the response
	lastActivity, err := time.Parse(time.RFC3339, status.LastActivity)
	if err != nil {
		return nil, fmt.Errorf("failed to parse last activity time: %w", err),
			"Jupyter probe failed: invalid last activity time", kubefloworgv1beta1.ProbeResultFailure
	}

	return &lastActivity, nil, "Jupyter probe succeeded", kubefloworgv1beta1.ProbeResultSuccess
}

// createExecutor creates a new Executor for the given URL and REST config.
func createExecutor(url *url.URL, config *rest.Config) (remotecommand.Executor, error) {
	exec, err := remotecommand.NewSPDYExecutor(config, "POST", url)
	if err != nil {
		return nil, err
	}
	// WebSocketExecutor must be "GET" method as described in RFC 6455 Sec. 4.1 (page 17).
	websocketExec, err := remotecommand.NewWebSocketExecutor(config, "GET", url.String())
	if err != nil {
		return nil, err
	}
	exec, err = remotecommand.NewFallbackExecutor(websocketExec, exec, func(err error) bool {
		return httpstream.IsUpgradeFailure(err) || isHTTPSProxyError(err)
	})
	if err != nil {
		return nil, err
	}

	return exec, nil
}

// isHTTPSProxyError checks if the given error is due to an unknown scheme in the proxy.
func isHTTPSProxyError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "proxy: unknown scheme: https")
}

// parseActivityProbeJson parses the JSON string into an ActivityProbe struct and ensures
// that at least has_activity or last_activity fields are present.
func parseActivityProbeJson(jsonString string) (*ActivityProbe, error) {
	activityProbe := &ActivityProbe{}
	if err := json.Unmarshal([]byte(jsonString), activityProbe); err != nil {
		return nil, err
	}
	if activityProbe.HasActivity == nil && activityProbe.LastActivity == nil {
		return nil, errors.New("has_activity and last_activity fields are missing in the activity probe JSON")
	}
	return activityProbe, nil

}
