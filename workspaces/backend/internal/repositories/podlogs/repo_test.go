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
	"sigs.k8s.io/controller-runtime/pkg/client"
	ctrlfake "sigs.k8s.io/controller-runtime/pkg/client/fake"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
	repoCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/common"
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

// newWorkspace builds a minimal Workspace CR. The pod is resolved by the controller's
// "workspace-name" label (not from status), so only the workspace's existence matters here.
func newWorkspace() *kubefloworgv1beta1.Workspace {
	return &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{Name: testWorkspace, Namespace: testNamespace},
	}
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

// newPod builds a workspace Pod (named testPodName) carrying the controller-managed
// "workspace-name" label. The pod spec is derived from the provided container statuses,
// mirroring a real pod where every container in the spec also reports a status.
func newPod(containerStatuses, initContainerStatuses []corev1.ContainerStatus) *corev1.Pod {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      testPodName,
			Namespace: testNamespace,
			Labels:    map[string]string{modelsCommon.LabelWorkspaceName: testWorkspace},
		},
		Status: corev1.PodStatus{
			ContainerStatuses:     containerStatuses,
			InitContainerStatuses: initContainerStatuses,
		},
	}
	for _, cs := range containerStatuses {
		pod.Spec.Containers = append(pod.Spec.Containers, corev1.Container{Name: cs.Name})
	}
	for _, cs := range initContainerStatuses {
		pod.Spec.InitContainers = append(pod.Spec.InitContainers, corev1.Container{Name: cs.Name})
	}
	return pod
}

// runningPod builds a workspace Pod whose regular containers are all Running. This is the
// common case where every container has started.
func runningPod(containers ...string) *corev1.Pod {
	statuses := make([]corev1.ContainerStatus, 0, len(containers))
	for _, c := range containers {
		statuses = append(statuses, runningContainerStatus(c))
	}
	return newPod(statuses, nil)
}

// runningPodWithInit builds a workspace Pod with Running regular and init containers (e.g.
// an istio-proxy native sidecar is an init container).
func runningPodWithInit(containers []string, initContainers []string) *corev1.Pod {
	regular := make([]corev1.ContainerStatus, 0, len(containers))
	for _, c := range containers {
		regular = append(regular, runningContainerStatus(c))
	}
	initStatuses := make([]corev1.ContainerStatus, 0, len(initContainers))
	for _, c := range initContainers {
		initStatuses = append(initStatuses, runningContainerStatus(c))
	}
	return newPod(regular, initStatuses)
}

// podSpecOnly builds a workspace Pod whose spec lists the given containers but which has
// not reported any container status yet.
func podSpecOnly(containers ...string) *corev1.Pod {
	pod := newPod(nil, nil)
	for _, c := range containers {
		pod.Spec.Containers = append(pod.Spec.Containers, corev1.Container{Name: c})
	}
	return pod
}

// newRepo builds a PodLogsRepository backed by a fake controller-runtime client seeded with
// the given workspace and pod (either may be nil), and an empty fake Kubernetes clientset.
// The pod is resolved via the controller-runtime client (by label); the clientset is only
// used to stream the logs, and its fake returns a canned log body regardless of seeding.
func newRepo(ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod) *PodLogsRepository {
	scheme, err := helper.BuildScheme()
	Expect(err).NotTo(HaveOccurred())

	objs := make([]client.Object, 0, 2)
	if ws != nil {
		objs = append(objs, ws)
	}
	if pod != nil {
		objs = append(objs, pod)
	}
	cl := ctrlfake.NewClientBuilder().WithScheme(scheme).WithObjects(objs...).Build()

	clientset := k8sfake.NewSimpleClientset()

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
			newWorkspace(),
			runningPod("main", "istio-proxy"),
			&models.LogOptions{}, nil, true),
		Entry("success with specific container",
			newWorkspace(),
			runningPod("main", "istio-proxy"),
			&models.LogOptions{Container: "istio-proxy"}, nil, true),
		Entry("success with init container (native sidecar)",
			newWorkspace(),
			runningPodWithInit([]string{"main"}, []string{"istio-proxy"}),
			&models.LogOptions{Container: "istio-proxy"}, nil, true),
		Entry("workspace not found",
			nil,
			nil,
			&models.LogOptions{}, repoCommon.ErrWorkspaceNotFound, false),
		Entry("pod not running (no pod for workspace)",
			newWorkspace(),
			nil,
			&models.LogOptions{}, repoCommon.ErrWorkspacePodNotRunning, false),
		Entry("container not found",
			newWorkspace(),
			runningPod("main"),
			&models.LogOptions{Container: "does-not-exist"}, ErrContainerNotFound, false),
		Entry("container not running when pod has no containers yet",
			newWorkspace(),
			newPod(nil, nil), // pod exists but spec has no containers
			&models.LogOptions{}, ErrContainerNotRunning, false),
		Entry("container waiting returns not running (default container)",
			newWorkspace(),
			newPod([]corev1.ContainerStatus{
				waitingContainerStatus("main", "PodInitializing"),
			}, nil),
			&models.LogOptions{}, ErrContainerNotRunning, false),
		Entry("requested container waiting returns not running",
			newWorkspace(),
			newPod([]corev1.ContainerStatus{
				runningContainerStatus("main"),
				waitingContainerStatus("istio-proxy", "ContainerCreating"),
			}, nil),
			&models.LogOptions{Container: "istio-proxy"}, ErrContainerNotRunning, false),
		Entry("waiting init container returns not running",
			newWorkspace(),
			newPod(
				[]corev1.ContainerStatus{runningContainerStatus("main")},
				[]corev1.ContainerStatus{waitingContainerStatus("istio-proxy", "PodInitializing")},
			),
			&models.LogOptions{Container: "istio-proxy"}, ErrContainerNotRunning, false),
		Entry("container in spec but no status reported yet returns not running",
			newWorkspace(),
			podSpecOnly("main"),
			&models.LogOptions{}, ErrContainerNotRunning, false),
		Entry("waiting current container is served when previous=true and a previous instance exists",
			newWorkspace(),
			newPod([]corev1.ContainerStatus{
				waitingContainerStatusWithPrevious("main", "CrashLoopBackOff"),
			}, nil),
			&models.LogOptions{Previous: true}, nil, true),
		Entry("previous=true with no previous terminated instance returns previous logs not found",
			newWorkspace(),
			newPod([]corev1.ContainerStatus{
				runningContainerStatus("main"), // running, but never restarted (no LastTerminationState)
			}, nil),
			&models.LogOptions{Previous: true}, ErrPreviousLogsNotFound, false),
		Entry("previous=true for an init container with no previous instance returns previous logs not found",
			newWorkspace(),
			runningPodWithInit([]string{"main"}, []string{"istio-proxy"}),
			&models.LogOptions{Container: "istio-proxy", Previous: true}, ErrPreviousLogsNotFound, false),
	)
})

var _ = Describe("PodLogsRepository.resolvePodAndContainer", func() {
	DescribeTable("resolving the target pod and container",
		func(ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod, requested, wantPod, wantContainer string, wantErr error) {
			repo := newRepo(ws, pod)

			gotPod, gotContainer, err := repo.resolvePodAndContainer(
				context.Background(), testNamespace, testWorkspace,
				&models.LogOptions{Container: requested},
			)

			if wantErr != nil {
				Expect(err).To(MatchError(wantErr))
				return
			}

			Expect(err).NotTo(HaveOccurred())
			Expect(gotPod).To(Equal(wantPod))
			Expect(gotContainer).To(Equal(wantContainer))
		},
		Entry("defaults to the primary 'main' container when none requested",
			newWorkspace(), runningPod("main", "istio-proxy"), "", testPodName, "main", nil),
		Entry("defaults to 'main' even when it is not the first container",
			newWorkspace(), runningPod("istio-proxy", "main"), "", testPodName, "main", nil),
		Entry("errors when none requested and no 'main' container exists",
			newWorkspace(), runningPod("istio-proxy"), "", "", "", ErrContainerNotFound),
		Entry("returns requested container when it exists",
			newWorkspace(), runningPod("main", "istio-proxy"), "istio-proxy", testPodName, "istio-proxy", nil),
		Entry("returns requested init container when it exists",
			newWorkspace(), runningPodWithInit([]string{"main"}, []string{"istio-proxy"}), "istio-proxy", testPodName, "istio-proxy", nil),
		Entry("errors when requested container does not exist",
			newWorkspace(), runningPod("main"), "nope", "", "", ErrContainerNotFound),
		Entry("errors when no pod exists for the workspace",
			newWorkspace(), nil, "", "", "", repoCommon.ErrWorkspacePodNotRunning),
		Entry("errors when pod has no containers yet",
			newWorkspace(), newPod(nil, nil), "", "", "", ErrContainerNotRunning),
	)
})
