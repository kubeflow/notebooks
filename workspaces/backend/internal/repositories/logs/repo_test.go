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
	"strings"
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
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

// newRepo builds a LogsRepository backed by a fake controller-runtime client
// (seeded with the given workspace) and a fake Kubernetes clientset.
func newRepo(t *testing.T, ws *kubefloworgv1beta1.Workspace) *LogsRepository {
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

	clientset := k8sfake.NewSimpleClientset()

	return NewLogsRepository(&config.EnvConfig{}, cl, clientset)
}

func TestGetWorkspaceLogs(t *testing.T) {
	testCases := []struct {
		name     string
		ws       *kubefloworgv1beta1.Workspace
		opts     *models.LogOptions
		wantErr  error // nil means success is expected
		wantLogs bool  // when success is expected, whether log lines should be returned
	}{
		{
			name:     "success with default container",
			ws:       newWorkspace(testPodName, "main", "istio-proxy"),
			opts:     &models.LogOptions{},
			wantLogs: true,
		},
		{
			name:     "success with specific container",
			ws:       newWorkspace(testPodName, "main", "istio-proxy"),
			opts:     &models.LogOptions{Container: "istio-proxy"},
			wantLogs: true,
		},
		{
			name:     "success with init container (native sidecar)",
			ws:       withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
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
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			repo := newRepo(t, tc.ws)

			logs, err := repo.GetWorkspaceLogs(context.Background(), testNamespace, testWorkspace, tc.opts)

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got: %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			// The fake clientset returns a canned non-empty log body ("fake logs"),
			// so we only assert that lines were produced.
			if tc.wantLogs && len(logs) == 0 {
				t.Fatalf("expected at least one log line, got none")
			}
		})
	}
}

func TestGetWorkspaceLogs_TailLines(t *testing.T) {
	testCases := []struct {
		name     string
		tail     int64
		wantTail int64
	}{
		{name: "explicit positive tail is forwarded", tail: 42, wantTail: 42},
		{name: "zero tail falls back to default", tail: 0, wantTail: defaultTailLines},
		{name: "negative tail falls back to default", tail: -5, wantTail: defaultTailLines},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var captured *corev1.PodLogOptions
			repo := newRepoCapturingLogOptions(t, newWorkspace(testPodName, "main"), &captured)

			_, err := repo.GetWorkspaceLogs(context.Background(), testNamespace, testWorkspace,
				&models.LogOptions{TailLines: tc.tail})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if captured == nil {
				t.Fatalf("PodLogOptions were not captured")
			}
			if captured.TailLines == nil {
				t.Fatalf("expected TailLines to be set, got nil")
			}
			if *captured.TailLines != tc.wantTail {
				t.Errorf("TailLines: want %d, got %d", tc.wantTail, *captured.TailLines)
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
			repo := newRepo(t, tc.ws)
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

func TestScanLogLines(t *testing.T) {
	testCases := []struct {
		name  string
		input string
		want  []string
	}{
		{name: "multiple lines", input: "a\nb\nc", want: []string{"a", "b", "c"}},
		{name: "trailing newline", input: "a\nb\n", want: []string{"a", "b"}},
		{name: "empty input", input: "", want: nil},
		{name: "single line", input: "only", want: []string{"only"}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var got []string
			err := scanLogLines(strings.NewReader(tc.input), func(line string) {
				got = append(got, line)
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(got) != len(tc.want) {
				t.Fatalf("line count: want %d, got %d (%v)", len(tc.want), len(got), got)
			}
			for i := range tc.want {
				if got[i] != tc.want[i] {
					t.Errorf("line %d: want %q, got %q", i, tc.want[i], got[i])
				}
			}
		})
	}
}

// newRepoCapturingLogOptions builds a repo whose fake clientset captures the
// PodLogOptions passed to GetLogs, so tests can assert on values (e.g. TailLines)
// forwarded to the Kubernetes API.
func newRepoCapturingLogOptions(t *testing.T, ws *kubefloworgv1beta1.Workspace, captured **corev1.PodLogOptions) *LogsRepository {
	t.Helper()

	scheme, err := helper.BuildScheme()
	if err != nil {
		t.Fatalf("failed to build scheme: %v", err)
	}

	cl := ctrlfake.NewClientBuilder().WithScheme(scheme).WithObjects(ws).Build()

	clientset := k8sfake.NewSimpleClientset()
	clientset.Fake.PrependReactor("get", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		if action.GetSubresource() == "log" {
			if ga, ok := action.(ktesting.GenericAction); ok {
				if opts, ok := ga.GetValue().(*corev1.PodLogOptions); ok {
					*captured = opts
				}
			}
		}
		// Return not-handled so the default fake GetLogs behavior still runs.
		return false, nil, nil
	})

	return NewLogsRepository(&config.EnvConfig{}, cl, clientset)
}
