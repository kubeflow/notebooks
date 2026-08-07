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

package podlogs

import (
	"context"
	"io"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	ctrlfake "sigs.k8s.io/controller-runtime/pkg/client/fake"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
)

func TestPodLogsRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "PodLogs Repository")
}

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

// waitingContainerStatusWithPrevious returns a ContainerStatus for a container
// that is currently Waiting but has a previous terminated instance, so requests
// for previous logs are considered available.
func waitingContainerStatusWithPrevious(name, reason string) corev1.ContainerStatus {
	cs := waitingContainerStatus(name, reason)
	cs.LastTerminationState = corev1.ContainerState{
		Terminated: &corev1.ContainerStateTerminated{ExitCode: 255},
	}
	return cs
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

// newRepo builds a PodLogsRepository backed by a fake controller-runtime client
// (seeded with the given workspace) and a fake Kubernetes clientset seeded with the
// given Pod (or nil for none).
func newRepo(ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod) *PodLogsRepository {
	scheme, err := helper.BuildScheme()
	Expect(err).NotTo(HaveOccurred())

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

	return NewPodLogsRepository(&config.EnvConfig{}, cl, clientset)
}

var _ = Describe("PodLogsRepository.OpenLogStream", func() {
	DescribeTable("resolving and opening the log stream",
		func(ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod, opts *models.LogOptions, wantErr error, wantLogs bool) {
			repo := newRepo(ws, pod)

			stream, err := repo.OpenLogStream(context.Background(), testNamespace, testWorkspace, opts)

			if wantErr != nil {
				Expect(err).To(MatchError(wantErr))
				return
			}

			Expect(err).NotTo(HaveOccurred())
			defer func() { _ = stream.Close() }()

			// The fake clientset returns a canned non-empty log body ("fake logs"),
			// so we only assert that content was produced.
			body, err := io.ReadAll(stream)
			Expect(err).NotTo(HaveOccurred())
			if wantLogs {
				Expect(body).NotTo(BeEmpty())
			}
		},
		Entry("success with default container",
			newWorkspace(testPodName, "main", "istio-proxy"),
			podFromWorkspace(newWorkspace(testPodName, "main", "istio-proxy")),
			&models.LogOptions{}, nil, true),
		Entry("success with specific container",
			newWorkspace(testPodName, "main", "istio-proxy"),
			podFromWorkspace(newWorkspace(testPodName, "main", "istio-proxy")),
			&models.LogOptions{Container: "istio-proxy"}, nil, true),
		Entry("success with init container (native sidecar)",
			withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
			podFromWorkspace(withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy")),
			&models.LogOptions{Container: "istio-proxy"}, nil, true),
		Entry("workspace not found",
			nil,
			nil,
			&models.LogOptions{}, ErrWorkspaceNotFound, false),
		Entry("pod not running",
			newWorkspace("", "main"),
			nil,
			&models.LogOptions{}, ErrPodNotRunning, false),
		Entry("container not found",
			newWorkspace(testPodName, "main"),
			nil,
			&models.LogOptions{Container: "does-not-exist"}, ErrContainerNotFound, false),
		Entry("container not running when pod has no containers yet",
			newWorkspace(testPodName), // pod name set, but no containers listed
			nil,
			&models.LogOptions{}, ErrContainerNotRunning, false),
		Entry("container waiting returns not running (default container)",
			newWorkspace(testPodName, "main"),
			newPod([]corev1.ContainerStatus{
				waitingContainerStatus("main", "PodInitializing"),
			}, nil),
			&models.LogOptions{}, ErrContainerNotRunning, false),
		Entry("requested container waiting returns not running",
			newWorkspace(testPodName, "main", "istio-proxy"),
			newPod([]corev1.ContainerStatus{
				runningContainerStatus("main"),
				waitingContainerStatus("istio-proxy", "ContainerCreating"),
			}, nil),
			&models.LogOptions{Container: "istio-proxy"}, ErrContainerNotRunning, false),
		Entry("waiting init container returns not running",
			withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
			newPod(
				[]corev1.ContainerStatus{runningContainerStatus("main")},
				[]corev1.ContainerStatus{waitingContainerStatus("istio-proxy", "PodInitializing")},
			),
			&models.LogOptions{Container: "istio-proxy"}, ErrContainerNotRunning, false),
		Entry("no container status reported yet returns not running",
			newWorkspace(testPodName, "main"),
			newPod(nil, nil),
			&models.LogOptions{}, ErrContainerNotRunning, false),
		Entry("live pod missing returns pod not running",
			// pod left nil: the Workspace references a pod the clientset cannot find.
			newWorkspace(testPodName, "main"),
			nil,
			&models.LogOptions{}, ErrPodNotRunning, false),
		Entry("waiting current container is served when previous=true and a previous instance exists",
			newWorkspace(testPodName, "main"),
			newPod([]corev1.ContainerStatus{
				waitingContainerStatusWithPrevious("main", "CrashLoopBackOff"),
			}, nil),
			&models.LogOptions{Previous: true}, nil, true),
		Entry("previous=true with no previous terminated instance returns previous logs not found",
			newWorkspace(testPodName, "main"),
			newPod([]corev1.ContainerStatus{
				runningContainerStatus("main"), // running, but never restarted (no LastTerminationState)
			}, nil),
			&models.LogOptions{Previous: true}, ErrPreviousLogsNotFound, false),
		Entry("previous=true for an init container with no previous instance returns previous logs not found",
			withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"),
			newPod(
				[]corev1.ContainerStatus{runningContainerStatus("main")},
				[]corev1.ContainerStatus{runningContainerStatus("istio-proxy")},
			),
			&models.LogOptions{Container: "istio-proxy", Previous: true}, ErrPreviousLogsNotFound, false),
	)
})

var _ = Describe("PodLogsRepository.resolvePodAndContainer", func() {
	DescribeTable("resolving the target pod and container",
		func(ws *kubefloworgv1beta1.Workspace, requested, wantPod, wantContainer string, wantErr error) {
			repo := newRepo(ws, podFromWorkspace(ws))

			pod, container, err := repo.resolvePodAndContainer(
				context.Background(), testNamespace, testWorkspace,
				&models.LogOptions{Container: requested},
			)

			if wantErr != nil {
				Expect(err).To(MatchError(wantErr))
				return
			}

			Expect(err).NotTo(HaveOccurred())
			Expect(pod).To(Equal(wantPod))
			Expect(container).To(Equal(wantContainer))
		},
		Entry("defaults to the primary 'main' container when none requested",
			newWorkspace(testPodName, "main", "istio-proxy"), "", testPodName, "main", nil),
		Entry("defaults to 'main' even when it is not the first container",
			newWorkspace(testPodName, "istio-proxy", "main"), "", testPodName, "main", nil),
		Entry("errors when none requested and no 'main' container exists",
			newWorkspace(testPodName, "istio-proxy"), "", "", "", ErrContainerNotFound),
		Entry("returns requested container when it exists",
			newWorkspace(testPodName, "main", "istio-proxy"), "istio-proxy", testPodName, "istio-proxy", nil),
		Entry("returns requested init container when it exists",
			withInitContainers(newWorkspace(testPodName, "main"), "istio-proxy"), "istio-proxy", testPodName, "istio-proxy", nil),
		Entry("errors when requested container does not exist",
			newWorkspace(testPodName, "main"), "nope", "", "", ErrContainerNotFound),
		Entry("errors when pod name is empty",
			newWorkspace("", "main"), "", "", "", ErrPodNotRunning),
		Entry("errors when pod has no containers yet",
			newWorkspace(testPodName), "", "", "", ErrContainerNotRunning),
	)
})
