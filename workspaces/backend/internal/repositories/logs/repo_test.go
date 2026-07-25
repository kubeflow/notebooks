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

package logs

import (
	"context"
	"errors"
	"io"
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	ctrlfake "sigs.k8s.io/controller-runtime/pkg/client/fake"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
)

const (
	testNamespace = "test-ns"
	testWorkspace = "test-ws"
	testPodName   = "ws-test-ws-0"
)

// newWorkspace builds a Workspace CR with the given pod status containers.
func newWorkspace(podName string, containers ...string) *kubefloworgv1beta1.Workspace {
	ws := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{Name: testWorkspace, Namespace: testNamespace},
	}
	ws.Status.PodTemplatePod.Name = podName
	for _, c := range containers {
		ws.Status.PodTemplatePod.Containers = append(
			ws.Status.PodTemplatePod.Containers,
			kubefloworgv1beta1.WorkspacePodContainer{Name: c},
		)
	}
	return ws
}

// withInitContainers adds init containers (e.g. an istio-proxy native sidecar) to
// the workspace pod status.
func withInitContainers(ws *kubefloworgv1beta1.Workspace, initContainers ...string) *kubefloworgv1beta1.Workspace {
	for _, c := range initContainers {
		ws.Status.PodTemplatePod.InitContainers = append(
			ws.Status.PodTemplatePod.InitContainers,
			kubefloworgv1beta1.WorkspacePodContainer{Name: c},
		)
	}
	return ws
}

// runningContainerStatus returns a ContainerStatus for a container that has started.
func runningContainerStatus(name string) corev1.ContainerStatus {
	return corev1.ContainerStatus{
		Name: name,
		State: corev1.ContainerState{
			Running: &corev1.ContainerStateRunning{},
		},
	}
}

// waitingContainerStatus returns a ContainerStatus for a container that is still Waiting.
func waitingContainerStatus(name, reason string) corev1.ContainerStatus {
	return corev1.ContainerStatus{
		Name: name,
		State: corev1.ContainerState{
			Waiting: &corev1.ContainerStateWaiting{Reason: reason},
		},
	}
}

// newPod builds a corev1.Pod (named testPodName) with the given regular and init
// container statuses.
func newPod(containerStatuses, initContainerStatuses []corev1.ContainerStatus) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: testPodName, Namespace: testNamespace},
		Status: corev1.PodStatus{
			ContainerStatuses:     containerStatuses,
			InitContainerStatuses: initContainerStatuses,
		},
	}
}

// podFromWorkspace builds a corev1.Pod whose container statuses mirror the
// workspace's pod status, with every container reported as Running. This is the
// common case where all containers have started.
func podFromWorkspace(ws *kubefloworgv1beta1.Workspace) *corev1.Pod {
	if ws == nil || ws.Status.PodTemplatePod.Name == "" {
		return nil
	}
	var containers, initContainers []corev1.ContainerStatus
	for _, c := range ws.Status.PodTemplatePod.Containers {
		containers = append(containers, runningContainerStatus(c.Name))
	}
	for _, c := range ws.Status.PodTemplatePod.InitContainers {
		initContainers = append(initContainers, runningContainerStatus(c.Name))
	}
	return newPod(containers, initContainers)
}

// newRepo builds a LogsRepository backed by a fake controller-runtime client
// (seeded with the given workspace) and a fake Kubernetes clientset seeded with the
// given Pod (or nil for none).
func newRepo(t *testing.T, ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod) *LogsRepository {
	t.Helper()

	scheme, err := helper.BuildScheme()
	if err != nil {
		t.Fatalf("failed to build scheme: %v", err)
	}

	builder := ctrlfake.NewClientBuilder().WithScheme(scheme)
	if ws != nil {
		builder = builder.WithObjects(ws)
	}
	cl := builder.Build()

	var clientset *k8sfake.Clientset
	if pod != nil {
		clientset = k8sfake.NewSimpleClientset(pod)
	} else {
		clientset = k8sfake.NewSimpleClientset()
	}

	return NewLogsRepository(&config.EnvConfig{}, cl, clientset)
}

func TestOpenLogStream(t *testing.T) {
	testCases := []struct {
		name string
		ws   *kubefloworgv1beta1.Workspace
		// pod is the live Pod seeded into the fake clientset. Leave nil to seed no
		// Pod (e.g. to test a missing pod); pass podFromWorkspace(ws) for the common
		// all-Running case.
		pod      *corev1.Pod
		opts     *models.LogOptions
		wantErr  error // nil means success is expected
		wantLogs bool  // when success is expected, whether log content should be returned
	}{
		{
			name:     "success with default container",
			ws:       newWorkspace(testPodName, "main", "istio-proxy"),
			pod:      podFromWorkspace(newWorkspace(testPodName, "main", "istio-proxy")),
			opts:     &models.LogOptions{},
			wantLogs: true,
		},
		{
			name:     "success with specific container",
			ws:       newWorkspace(testPodName, "main", "istio-proxy"),
			pod:      podFromWorkspace(newWorkspace(testPodName, "main", "istio-proxy")),
			opts:     &models.LogOptions{Container: "istio-proxy"},
			wantLogs: true,
		},
		{
			name:     "success with init container (native sidecar)",
			ws:       withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
			pod:      podFromWorkspace(withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy")),
			opts:     &models.LogOptions{Container: "istio-proxy"},
			wantLogs: true,
		},
		{
			name:    "workspace not found",
			ws:      nil,
			opts:    &models.LogOptions{},
			wantErr: ErrWorkspaceNotFound,
		},
		{
			name:    "pod not running",
			ws:      newWorkspace("", "main"),
			opts:    &models.LogOptions{},
			wantErr: ErrPodNotRunning,
		},
		{
			name:    "container not found",
			ws:      newWorkspace(testPodName, "main"),
			opts:    &models.LogOptions{Container: "does-not-exist"},
			wantErr: ErrContainerNotFound,
		},
		{
			name:    "container not running when pod has no containers yet",
			ws:      newWorkspace(testPodName), // pod name set, but no containers listed
			opts:    &models.LogOptions{},
			wantErr: ErrContainerNotRunning,
		},
		{
			name: "container waiting returns not running (default container)",
			ws:   newWorkspace(testPodName, "main"),
			pod: newPod([]corev1.ContainerStatus{
				waitingContainerStatus("main", "PodInitializing"),
			}, nil),
			opts:    &models.LogOptions{},
			wantErr: ErrContainerNotRunning,
		},
		{
			name: "requested container waiting returns not running",
			ws:   newWorkspace(testPodName, "main", "istio-proxy"),
			pod: newPod([]corev1.ContainerStatus{
				runningContainerStatus("main"),
				waitingContainerStatus("istio-proxy", "ContainerCreating"),
			}, nil),
			opts:    &models.LogOptions{Container: "istio-proxy"},
			wantErr: ErrContainerNotRunning,
		},
		{
			name: "waiting init container returns not running",
			ws:   withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
			pod: newPod(
				[]corev1.ContainerStatus{runningContainerStatus("main")},
				[]corev1.ContainerStatus{waitingContainerStatus("istio-proxy", "PodInitializing")},
			),
			opts:    &models.LogOptions{Container: "istio-proxy"},
			wantErr: ErrContainerNotRunning,
		},
		{
			name:    "no container status reported yet returns not running",
			ws:      newWorkspace(testPodName, "main"),
			pod:     newPod(nil, nil),
			opts:    &models.LogOptions{},
			wantErr: ErrContainerNotRunning,
		},
		{
			// pod left nil: the Workspace references a pod the clientset cannot find.
			name:    "live pod missing returns pod not running",
			ws:      newWorkspace(testPodName, "main"),
			opts:    &models.LogOptions{},
			wantErr: ErrPodNotRunning,
		},
		{
			name: "waiting current container is bypassed when previous=true",
			ws:   newWorkspace(testPodName, "main"),
			pod: newPod([]corev1.ContainerStatus{
				waitingContainerStatus("main", "CrashLoopBackOff"),
			}, nil),
			opts:     &models.LogOptions{Previous: true},
			wantLogs: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			repo := newRepo(t, tc.ws, tc.pod)

			stream, err := repo.OpenLogStream(context.Background(), testNamespace, testWorkspace, tc.opts)

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got: %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			defer stream.Close()

			// The fake clientset returns a canned non-empty log body ("fake logs"),
			// so we only assert that content was produced.
			body, err := io.ReadAll(stream)
			if err != nil {
				t.Fatalf("unexpected error reading stream: %v", err)
			}
			if tc.wantLogs && len(body) == 0 {
				t.Fatalf("expected at least some log content, got none")
			}
		})
	}
}

func TestResolvePodAndContainer(t *testing.T) {
	testCases := []struct {
		name          string
		ws            *kubefloworgv1beta1.Workspace
		requested     string
		wantPod       string
		wantContainer string
		wantErr       error
	}{
		{
			name:          "defaults to first container when none requested",
			ws:            newWorkspace(testPodName, "main", "istio-proxy"),
			requested:     "",
			wantPod:       testPodName,
			wantContainer: "main",
		},
		{
			name:          "returns requested container when it exists",
			ws:            newWorkspace(testPodName, "main", "istio-proxy"),
			requested:     "istio-proxy",
			wantPod:       testPodName,
			wantContainer: "istio-proxy",
		},
		{
			name:          "returns requested init container when it exists",
			ws:            withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
			requested:     "istio-proxy",
			wantPod:       testPodName,
			wantContainer: "istio-proxy",
		},
		{
			name:      "errors when requested container does not exist",
			ws:        newWorkspace(testPodName, "main"),
			requested: "nope",
			wantErr:   ErrContainerNotFound,
		},
		{
			name:      "errors when pod name is empty",
			ws:        newWorkspace("", "main"),
			requested: "",
			wantErr:   ErrPodNotRunning,
		},
		{
			name:      "errors when pod has no containers yet",
			ws:        newWorkspace(testPodName),
			requested: "",
			wantErr:   ErrContainerNotRunning,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			repo := newRepo(t, tc.ws, podFromWorkspace(tc.ws))
			pod, container, err := repo.resolvePodAndContainer(
				context.Background(), testNamespace, testWorkspace,
				&models.LogOptions{Container: tc.requested},
			)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got: %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if pod != tc.wantPod {
				t.Errorf("pod: want %q, got %q", tc.wantPod, pod)
			}
			if container != tc.wantContainer {
				t.Errorf("container: want %q, got %q", tc.wantContainer, container)
			}
		})
	}
}
