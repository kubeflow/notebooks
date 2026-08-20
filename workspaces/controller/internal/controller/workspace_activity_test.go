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
	"io"
	"net/http"
	"strings"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
	logf "sigs.k8s.io/controller-runtime/pkg/log"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

const (
	testTimestampRFC3339 = "2030-01-01T00:00:00Z"

	testInitialActivityMs = int64(1000)
	testLastActivityMs    = int64(4000)
	testStartTimeMs       = int64(5000)
	testEndTimeMs         = int64(5100)
	testEligibleAfterMs   = int64(1016000)

	testSecondsSinceActive1Hour = int32(3600)
	testMinRunningSeconds2Hours = int32(7200)

	testOneHourMs = int64(3600) * 1000
	testNowMs     = int64(2_000_000_000_000)
)

var (
	testStartTime        = time.UnixMilli(testStartTimeMs)
	testEndTime          = time.UnixMilli(testEndTimeMs)
	testLastActivityTime = time.UnixMilli(testLastActivityMs)
)

var _ = Describe("mergeReconcileResult", func() {
	It("should prefer an immediate requeue", func() {
		a := ctrl.Result{Requeue: true}
		b := ctrl.Result{RequeueAfter: time.Second}
		Expect(mergeReconcileResult(a, b)).To(Equal(a))
	})

	It("should prefer the sooner RequeueAfter", func() {
		a := ctrl.Result{RequeueAfter: 10 * time.Second}
		b := ctrl.Result{RequeueAfter: 3 * time.Second}
		Expect(mergeReconcileResult(a, b)).To(Equal(b))
	})

	It("should return the non-zero RequeueAfter when the other is zero", func() {
		a := ctrl.Result{}
		b := ctrl.Result{RequeueAfter: 3 * time.Second}
		Expect(mergeReconcileResult(a, b)).To(Equal(b))
	})
})

var _ = Describe("imageConfigPortForID", func() {
	imageConfig := &kubefloworgv1beta1.ImageConfigValue{
		Spec: kubefloworgv1beta1.ImageConfigSpec{
			Ports: []kubefloworgv1beta1.ImagePort{
				{Id: "jupyterlab", Port: 8888},
				{Id: "vscode", Port: 8080},
			},
		},
	}

	It("should resolve a known port id", func() {
		port, ok := imageConfigPortForID(imageConfig, "jupyterlab")
		Expect(ok).To(BeTrue())
		Expect(port).To(Equal(int32(8888)))
	})

	It("should return not-found for an unknown id", func() {
		_, ok := imageConfigPortForID(imageConfig, "unknown")
		Expect(ok).To(BeFalse())
	})

	It("should return not-found for a nil imageConfig", func() {
		_, ok := imageConfigPortForID(nil, "jupyterlab")
		Expect(ok).To(BeFalse())
	})
})

var _ = Describe("updateActivityStatusFromProbe", func() {
	var workspace *kubefloworgv1beta1.Workspace

	BeforeEach(func() {
		workspace = &kubefloworgv1beta1.Workspace{
			Status: kubefloworgv1beta1.WorkspaceStatus{
				Activity: kubefloworgv1beta1.WorkspaceActivity{
					LastActivity: testInitialActivityMs,
					LastUpdate:   testInitialActivityMs,
				},
			},
		}
	})

	It("should advance lastActivity and lastUpdate on success", func() {
		result := &helper.ProbeResult{
			StartTime:    testStartTime,
			EndTime:      testEndTime,
			Result:       kubefloworgv1beta1.WorkspaceProbeResultSuccess,
			Message:      "Jupyter probe succeeded",
			LastActivity: &testLastActivityTime,
		}
		updateActivityStatusFromProbe(workspace, result)
		Expect(workspace.Status.Activity.LastActivity).To(Equal(testLastActivityMs))
		Expect(workspace.Status.Activity.LastUpdate).To(Equal(testEndTimeMs))
		Expect(workspace.Status.Activity.LastProbe.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
	})

	It("should update lastUpdate but not lastActivity when probe returns no activity", func() {
		result := &helper.ProbeResult{
			StartTime:    testStartTime,
			EndTime:      testEndTime,
			Result:       kubefloworgv1beta1.WorkspaceProbeResultSuccess,
			Message:      "PodExec probe succeeded",
			LastActivity: nil,
		}
		updateActivityStatusFromProbe(workspace, result)
		Expect(workspace.Status.Activity.LastActivity).To(Equal(testInitialActivityMs))
		Expect(workspace.Status.Activity.LastUpdate).To(Equal(testEndTimeMs))
	})

	It("should preserve lastActivity and lastUpdate on failure", func() {
		result := &helper.ProbeResult{
			StartTime: testStartTime,
			EndTime:   testEndTime,
			Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
			Message:   "Jupyter probe failed: HTTP 500",
		}
		updateActivityStatusFromProbe(workspace, result)
		Expect(workspace.Status.Activity.LastActivity).To(Equal(testInitialActivityMs))
		Expect(workspace.Status.Activity.LastUpdate).To(Equal(testInitialActivityMs))
		Expect(workspace.Status.Activity.LastProbe.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
	})
})

var _ = Describe("generateWorkspaceStatus activity status reset on restart", func() {
	var (
		scheme *runtime.Scheme
		log    = logf.Log
	)

	BeforeEach(func() {
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
	})

	It("should reset status.Activity when entering WorkspaceStateRunning from a non-Running state", func() {
		c := fake.NewClientBuilder().WithScheme(scheme).Build()
		r := &WorkspaceReconciler{Client: c, Scheme: scheme}

		ws := &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{Name: "ws", Namespace: "team-a"},
			Spec:       kubefloworgv1beta1.WorkspaceSpec{Paused: false},
			Status: kubefloworgv1beta1.WorkspaceStatus{
				State:           kubefloworgv1beta1.WorkspaceStatePaused,
				LastRunningTime: testInitialActivityMs,
				Activity: kubefloworgv1beta1.WorkspaceActivity{
					LastActivity: testInitialActivityMs,
					LastUpdate:   testInitialActivityMs,
					LastProbe: &kubefloworgv1beta1.WorkspaceActivityLastProbe{
						Result: kubefloworgv1beta1.WorkspaceProbeResultSuccess,
					},
					Rules: &kubefloworgv1beta1.WorkspaceActivityRules{
						PauseWorkspace: &kubefloworgv1beta1.WorkspaceActivityPauseRule{EligibleAfter: testEligibleAfterMs},
					},
				},
			},
		}

		pod := &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "ws-0", Namespace: "team-a"},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				Conditions: []corev1.PodCondition{
					{Type: corev1.PodReady, Status: corev1.ConditionTrue},
				},
			},
		}

		status, _, err := r.generateWorkspaceStatus(ctx, log, ws, pod, nil, "")
		Expect(err).NotTo(HaveOccurred())
		Expect(status.State).To(Equal(kubefloworgv1beta1.WorkspaceStateRunning))
		Expect(status.Activity).To(Equal(kubefloworgv1beta1.WorkspaceActivity{}))
		Expect(status.LastRunningTime).To(BeNumerically(">", testInitialActivityMs))
	})
})

var _ = Describe("evaluatePauseDecision", func() {
	var (
		scheme *runtime.Scheme
		now    = testNowMs
	)

	BeforeEach(func() {
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
		now = testNowMs
	})

	newWorkspace := func(lastActivity, lastRunningTime int64) *kubefloworgv1beta1.Workspace {
		return &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{Name: "ws", Namespace: "team-a"},
			Spec:       kubefloworgv1beta1.WorkspaceSpec{Paused: false},
			Status: kubefloworgv1beta1.WorkspaceStatus{
				State:           kubefloworgv1beta1.WorkspaceStateRunning,
				LastRunningTime: lastRunningTime,
				Activity: kubefloworgv1beta1.WorkspaceActivity{
					LastActivity: lastActivity,
				},
			},
		}
	}

	catchAllKind := func() *kubefloworgv1beta1.WorkspaceKind {
		return &kubefloworgv1beta1.WorkspaceKind{
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				ActivityRules: []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: testSecondsSinceActive1Hour},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: new(true)},
					},
				},
			},
		}
	}

	It("should set eligibleAfter and pause when eligible and allowPause is true", func() {
		lastActivity := now - testOneHourMs // exactly one hour ago -> eligible
		ws := newWorkspace(lastActivity, now-testOneHourMs)
		paused, err := evaluatePauseDecision(ws, catchAllKind(), nil, nil, now, true)
		Expect(err).ToNot(HaveOccurred())
		Expect(paused).To(BeTrue())
		Expect(ws.Status.Activity.Rules).ToNot(BeNil())
		Expect(ws.Status.Activity.Rules.PauseWorkspace.EligibleAfter).To(Equal(lastActivity + testOneHourMs))
	})

	It("should refresh eligibleAfter but NOT pause when eligible and allowPause is false (stale data)", func() {
		lastActivity := now - testOneHourMs // exactly one hour ago -> eligible by stale data
		ws := newWorkspace(lastActivity, now-testOneHourMs)
		paused, err := evaluatePauseDecision(ws, catchAllKind(), nil, nil, now, false)
		Expect(err).ToNot(HaveOccurred())
		// even though the (stale) activity data says the Workspace is eligible, it must NOT be
		// paused because no fresh probe backed this decision.
		Expect(paused).To(BeFalse())
		Expect(ws.Spec.Paused).To(BeFalse())
		// the eligibleAfter status is still refreshed for the UI.
		Expect(ws.Status.Activity.Rules).ToNot(BeNil())
		Expect(ws.Status.Activity.Rules.PauseWorkspace.EligibleAfter).To(Equal(lastActivity + testOneHourMs))
	})

	It("should set eligibleAfter but not pause when not yet eligible", func() {
		lastActivity := now - testOneHourMs/2 // 30 min ago -> not eligible
		ws := newWorkspace(lastActivity, now-testOneHourMs)
		paused, err := evaluatePauseDecision(ws, catchAllKind(), nil, nil, now, true)
		Expect(err).ToNot(HaveOccurred())
		Expect(paused).To(BeFalse())
		Expect(ws.Spec.Paused).To(BeFalse())
		Expect(ws.Status.Activity.Rules.PauseWorkspace.EligibleAfter).To(Equal(lastActivity + testOneHourMs))
	})

	It("should not pause when a matched rule opts out (pauseWorkspace: false)", func() {
		kind := &kubefloworgv1beta1.WorkspaceKind{
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				ActivityRules: []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: testSecondsSinceActive1Hour},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{
							MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
								Selector: metav1.LabelSelector{MatchLabels: map[string]string{"protected": "true"}},
							},
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: new(false)},
					},
				},
			},
		}
		lastActivity := now - testOneHourMs
		ws := newWorkspace(lastActivity, now-testOneHourMs)
		paused, err := evaluatePauseDecision(ws, kind, map[string]string{"protected": "true"}, nil, now, true)
		Expect(err).ToNot(HaveOccurred())
		Expect(paused).To(BeFalse())
		if ws.Status.Activity.Rules != nil {
			Expect(ws.Status.Activity.Rules.PauseWorkspace).To(BeNil())
		}
	})

	It("should clear rules status when no rules configured", func() {
		kind := &kubefloworgv1beta1.WorkspaceKind{}
		ws := newWorkspace(now-testOneHourMs, now-testOneHourMs)
		ws.Status.Activity.Rules = &kubefloworgv1beta1.WorkspaceActivityRules{
			PauseWorkspace: &kubefloworgv1beta1.WorkspaceActivityPauseRule{EligibleAfter: 123},
		}
		paused, err := evaluatePauseDecision(ws, kind, nil, nil, now, true)
		Expect(err).ToNot(HaveOccurred())
		Expect(paused).To(BeFalse())
		Expect(ws.Status.Activity.Rules).ToNot(BeNil())
		Expect(ws.Status.Activity.Rules.PauseWorkspace).To(BeNil())
	})

	It("should not pause when running duration is below minRunningSeconds", func() {
		kind := &kubefloworgv1beta1.WorkspaceKind{
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				ActivityRules: []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: testSecondsSinceActive1Hour,
							MinRunningSeconds:  new(testMinRunningSeconds2Hours), // 2 hours
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: new(true)},
					},
				},
			},
		}
		lastActivity := now - testOneHourMs
		ws := newWorkspace(lastActivity, now-testOneHourMs) // only running 1h < 2h
		paused, err := evaluatePauseDecision(ws, kind, nil, nil, now, true)
		Expect(err).ToNot(HaveOccurred())
		Expect(paused).To(BeFalse())
	})

	It("should return an error when activityRules have an invalid selector", func() {
		kind := &kubefloworgv1beta1.WorkspaceKind{
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				ActivityRules: []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: testSecondsSinceActive1Hour},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{
							MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
								Selector: metav1.LabelSelector{
									MatchExpressions: []metav1.LabelSelectorRequirement{
										{Key: "tier", Operator: "InvalidOp"},
									},
								},
							},
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: new(true)},
					},
				},
			},
		}
		ws := newWorkspace(now-testOneHourMs, now-testOneHourMs)
		_, err := evaluatePauseDecision(ws, kind, nil, nil, now, true)
		Expect(err).To(HaveOccurred())
	})
})

var _ = Describe("getNamespaceLabels", func() {
	var scheme *runtime.Scheme

	BeforeEach(func() {
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
	})

	It("should return the namespace labels when the namespace exists", func() {
		ns := &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{Name: "team-a", Labels: map[string]string{"team": "a"}},
		}
		c := fake.NewClientBuilder().WithScheme(scheme).WithObjects(ns).Build()
		r := &WorkspaceReconciler{Client: c, Scheme: scheme}

		labels, err := r.getNamespaceLabels(ctx, "team-a")
		Expect(err).NotTo(HaveOccurred())
		Expect(labels).To(Equal(map[string]string{"team": "a"}))
	})

	It("should return a non-nil empty map when the namespace has no labels", func() {
		ns := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "team-a"}}
		c := fake.NewClientBuilder().WithScheme(scheme).WithObjects(ns).Build()
		r := &WorkspaceReconciler{Client: c, Scheme: scheme}

		labels, err := r.getNamespaceLabels(ctx, "team-a")
		Expect(err).NotTo(HaveOccurred())
		Expect(labels).NotTo(BeNil())
		Expect(labels).To(BeEmpty())
	})

	It("should return a non-nil empty map when the namespace does not exist", func() {
		c := fake.NewClientBuilder().WithScheme(scheme).Build()
		r := &WorkspaceReconciler{Client: c, Scheme: scheme}

		labels, err := r.getNamespaceLabels(ctx, "missing")
		Expect(err).NotTo(HaveOccurred())
		Expect(labels).NotTo(BeNil())
		Expect(labels).To(BeEmpty())
	})
})

var _ = Describe("timeUntilProbeDue", func() {
	const (
		minProbeInterval = 5 * time.Minute
		probeInterval    = 60 * time.Minute
	)

	now := testNowMs

	workspaceWithLastProbe := func(startTime int64, result kubefloworgv1beta1.WorkspaceProbeResult) *kubefloworgv1beta1.Workspace {
		ws := &kubefloworgv1beta1.Workspace{}
		if startTime >= 0 {
			ws.Status.Activity.LastProbe = &kubefloworgv1beta1.WorkspaceActivityLastProbe{
				StartTime: startTime,
				Result:    result,
			}
		}
		return ws
	}

	It("should be due when no probe has run yet", func() {
		ws := workspaceWithLastProbe(-1, "") // no LastProbe
		_, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeTrue())
	})

	It("should be due when the last probe start time is zero", func() {
		ws := workspaceWithLastProbe(0, kubefloworgv1beta1.WorkspaceProbeResultSuccess)
		_, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeTrue())
	})

	It("should not be due when within probeInterval after success, returning the remaining time", func() {
		// last probe started 10 minutes ago; probeInterval is 60 minutes -> not due
		lastProbeStart := now - (10 * time.Minute).Milliseconds()
		ws := workspaceWithLastProbe(lastProbeStart, kubefloworgv1beta1.WorkspaceProbeResultSuccess)
		remaining, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeFalse())
		Expect(remaining).To(Equal(probeInterval - 10*time.Minute))
	})

	It("should be due after minProbeInterval when the last probe failed", func() {
		// last probe failed 10 minutes ago; minProbeInterval is 5 minutes -> due
		lastProbeStart := now - (10 * time.Minute).Milliseconds()
		ws := workspaceWithLastProbe(lastProbeStart, kubefloworgv1beta1.WorkspaceProbeResultFailure)
		_, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeTrue())
	})

	It("should not be due before minProbeInterval even if the last probe failed", func() {
		// last probe failed 2 minutes ago; minProbeInterval is 5 minutes -> not due
		lastProbeStart := now - (2 * time.Minute).Milliseconds()
		ws := workspaceWithLastProbe(lastProbeStart, kubefloworgv1beta1.WorkspaceProbeResultFailure)
		remaining, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeFalse())
		Expect(remaining).To(Equal(minProbeInterval - 2*time.Minute))
	})

	It("should be due once probeInterval has elapsed", func() {
		lastProbeStart := now - probeInterval.Milliseconds()
		ws := workspaceWithLastProbe(lastProbeStart, kubefloworgv1beta1.WorkspaceProbeResultSuccess)
		_, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeTrue())
	})

	It("should be due after minProbeInterval when the last probe timed out", func() {
		// last probe timed out 10 minutes ago; minProbeInterval is 5 minutes -> due
		lastProbeStart := now - (10 * time.Minute).Milliseconds()
		ws := workspaceWithLastProbe(lastProbeStart, kubefloworgv1beta1.WorkspaceProbeResultTimeout)
		_, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeTrue())
	})

	It("should use the probeInterval on success", func() {
		lastProbeStart := now - (10 * time.Minute).Milliseconds()
		ws := workspaceWithLastProbe(lastProbeStart, kubefloworgv1beta1.WorkspaceProbeResultSuccess)
		remaining, due := timeUntilProbeDue(ws, now, minProbeInterval, probeInterval)
		Expect(due).To(BeFalse())
		Expect(remaining).To(Equal(probeInterval - 10*time.Minute))
	})
})

// fakeHTTPProber and fakePodExecutor are test doubles for the probe interfaces used by runProbe.

type fakeHTTPProber struct {
	resp *http.Response
	err  error
}

func (f *fakeHTTPProber) Get(_ context.Context, _ string) (*http.Response, error) {
	return f.resp, f.err
}

type fakePodExecutor struct {
	stdout string
	err    error
}

func (f *fakePodExecutor) Exec(_ context.Context, _, _, _ string, _ []string, stdin io.Reader, stdout, stderr io.Writer) error {
	if stdin != nil {
		_, _ = io.Copy(io.Discard, stdin)
	}
	if f.err != nil {
		return f.err
	}
	if stdout != nil && f.stdout != "" {
		_, _ = io.WriteString(stdout, f.stdout)
	}
	return nil
}

var _ = Describe("runProbe", func() {
	imageConfig := &kubefloworgv1beta1.ImageConfigValue{
		Spec: kubefloworgv1beta1.ImageConfigSpec{
			Ports: []kubefloworgv1beta1.ImagePort{{Id: "jupyterlab", Port: 8888}},
		},
	}

	runningPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "ws-pod-0", Namespace: "team-a"},
		Status:     corev1.PodStatus{PodIP: "10.0.0.1"},
	}

	jupyterProbe := &kubefloworgv1beta1.ActivityProbe{
		Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true, PortId: "jupyterlab"},
	}
	podExecProbe := &kubefloworgv1beta1.ActivityProbe{
		PodExec: &kubefloworgv1beta1.ActivityProbePodExec{Script: "#!/usr/bin/env bash\nexit 0"},
	}

	It("should fail when the Pod is nil", func() {
		r := &WorkspaceReconciler{}
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, jupyterProbe, imageConfig, nil)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("not ready"))
	})

	It("should fail when the Pod has no IP", func() {
		r := &WorkspaceReconciler{}
		podNoIP := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p", Namespace: "n"}}
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, jupyterProbe, imageConfig, podNoIP)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("not ready"))
	})

	It("should run a Jupyter probe using the injected HTTPProber", func() {
		r := &WorkspaceReconciler{
			HTTPProber: &fakeHTTPProber{
				resp: &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(fmt.Sprintf(`{"last_activity":%q}`, testTimestampRFC3339))),
					Header:     make(http.Header),
				},
			},
		}
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, jupyterProbe, imageConfig, runningPod)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
	})

	It("should fail a Jupyter probe when the port id is not in the imageConfig", func() {
		r := &WorkspaceReconciler{HTTPProber: &fakeHTTPProber{}}
		badProbe := &kubefloworgv1beta1.ActivityProbe{
			Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true, PortId: "does-not-exist"},
		}
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, badProbe, imageConfig, runningPod)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("not found in imageConfig"))
	})

	It("should fail a Jupyter probe when no http prober is configured", func() {
		r := &WorkspaceReconciler{} // HTTPProber is nil
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, jupyterProbe, imageConfig, runningPod)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("http prober is not configured"))
	})

	It("should fail a podExec probe when no executor is configured", func() {
		r := &WorkspaceReconciler{} // PodExecutor is nil
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, podExecProbe, imageConfig, runningPod)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("exec is not configured"))
	})

	It("should run a podExec probe using the injected PodExecutor", func() {
		r := &WorkspaceReconciler{
			PodExecutor: &fakePodExecutor{stdout: `{"has_activity": true}`},
		}
		result := r.runProbe(ctx, &kubefloworgv1beta1.Workspace{}, podExecProbe, imageConfig, runningPod)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
	})
})
