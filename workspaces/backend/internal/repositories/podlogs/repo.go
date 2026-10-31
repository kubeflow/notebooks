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
	"fmt"
	"io"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
	repoCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/common"
)

var (
	ErrContainerNotFound    = fmt.Errorf("container not found in workspace pod")
	ErrContainerNotRunning  = fmt.Errorf("container has not started yet")
	ErrPreviousLogsNotFound = fmt.Errorf("no logs found for the previous container instance")
)

// Format-string templates for wrapped errors.
const (
	fmtOpenLogStreamFailed = "failed to open log stream for pod %s, container %s: %w"
	fmtListPodsFailed      = "failed to list pods for workspace %s: %w"
)

var (
	// safeLimitBytes is the maximum number of bytes the Kubernetes API will return
	// for a single log request, bounding the size of the proxied stream.
	safeLimitBytes = int64(100 * 1024 * 1024) // 100 MB
	// defaultTailLines is the default number of lines to retrieve from the end of the logs.
	defaultTailLines = int64(1000)
)

// primaryContainerName is the name the controller hard-codes for a workspace's
// primary container. When no container is requested we default to it so
// that logs never accidentally target an injected sidecar (e.g. istio-proxy).
//
// This mirrors the controller's `workspacePodTemplateContainerName` constant defined in
// workspaces/controller/internal/controller/workspace_controller.go
const primaryContainerName = "main"

type PodLogsRepository struct {
	cfg       *config.EnvConfig
	client    client.Client
	clientset kubernetes.Interface
}

func NewPodLogsRepository(cfg *config.EnvConfig, cl client.Client, clientset kubernetes.Interface) *PodLogsRepository {
	return &PodLogsRepository{
		cfg:       cfg,
		client:    cl,
		clientset: clientset,
	}
}

func (r *PodLogsRepository) OpenLogStream(ctx context.Context, namespace, workspaceName string, opts *models.LogOptions) (io.ReadCloser, error) {
	podName, containerName, err := r.resolvePodAndContainer(ctx, namespace, workspaceName, opts)
	if err != nil {
		return nil, err
	}

	tailLines := opts.TailLines
	if tailLines <= 0 {
		tailLines = defaultTailLines
	}

	req := r.clientset.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
		Container:  containerName,
		TailLines:  &tailLines,
		LimitBytes: &safeLimitBytes,
		Previous:   opts.Previous,
		Follow:     false,
		Timestamps: true,
		SinceTime:  opts.SinceTime,
	})

	stream, err := req.Stream(ctx)
	if err != nil {
		return nil, fmt.Errorf(fmtOpenLogStreamFailed, podName, containerName, err)
	}
	return stream, nil
}

// podSpecContainerExists reports whether a container with the given name
// exists among the pod's regular or init containers. Both are valid log
// sources (e.g. an istio-proxy native sidecar is an init container).
//
// The pod spec is authoritative and controller-managed, unlike
// workspace.status which is writable by the user.
func podSpecContainerExists(pod *corev1.Pod, name string) bool {
	for _, c := range pod.Spec.Containers {
		if c.Name == name {
			return true
		}
	}
	for _, c := range pod.Spec.InitContainers {
		if c.Name == name {
			return true
		}
	}
	return false
}

func (r *PodLogsRepository) resolvePodAndContainer(ctx context.Context, namespace, workspaceName string, opts *models.LogOptions) (string, string, error) {
	// Confirm the workspace exists. The pod is resolved by label below, so
	// without this a workspace that never existed would be indistinguishable
	// from one that is merely paused, and both would report
	// WORKSPACE_POD_NOT_RUNNING. This read is served from the cache.
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return "", "", repoCommon.ErrWorkspaceNotFound
		}
		return "", "", err
	}

	// Resolve the target pod from the controller-managed "workspace-name"
	// label and not from workspace.status.podTemplatePod, since the status
	// field is writable by any user who can patch the Workspace, which means a
	// user could redirect our request to an arbitrary pod whose logs are
	// subsequently read via the backend's SA.
	selector := client.MatchingLabels{modelsCommon.LabelWorkspaceName: workspaceName}
	podList := &corev1.PodList{}
	if err := r.client.List(ctx, podList, client.InNamespace(namespace), selector); err != nil {
		return "", "", fmt.Errorf(fmtListPodsFailed, workspaceName, err)
	}
	if len(podList.Items) == 0 {
		return "", "", repoCommon.ErrWorkspacePodNotRunning
	}
	// Workspaces are backed by StatefulSets with replicas=1, so there is at most one pod.
	pod := &podList.Items[0]

	// Resolve the target container name against the real pod spec.
	containerName := opts.Container
	if containerName != "" {
		// A requested container must exist among the pod's containers.
		if !podSpecContainerExists(pod, containerName) {
			return "", "", ErrContainerNotFound
		}
	} else {
		if len(pod.Spec.Containers) == 0 {
			return "", "", ErrContainerNotRunning
		}
		if !podSpecContainerExists(pod, primaryContainerName) {
			return "", "", ErrContainerNotFound
		}
		// None requested: default to the primary container, which the controller
		// hard-codes as "main".
		containerName = primaryContainerName
	}

	// Inspect the Pod status so we can return a precise error instead of an
	// opaque one from the Kubernetes log API.
	if err := ensureLogsAvailable(pod, containerName, opts.Previous); err != nil {
		return "", "", err
	}

	return pod.Name, containerName, nil
}

// ensureLogsAvailable checks the Pod status for the target container and
// returns a semantic error when logs cannot be served:
//   - when previous is false and the container is still Waiting (never started),
//     it returns ErrContainerNotRunning.
//   - when previous is true and the container has no recorded previous terminated
//     instance (LastTerminationState.Terminated is nil), it returns
//     ErrPreviousLogsNotFound.
func ensureLogsAvailable(pod *corev1.Pod, containerName string, previous bool) error {
	// checkStatus evaluates a single container status for the target container.
	checkStatus := func(cs corev1.ContainerStatus) error {
		if previous {
			// A container with no recorded previous terminated instance has no
			// previous logs to serve.
			if cs.LastTerminationState.Terminated == nil {
				return ErrPreviousLogsNotFound
			}
			return nil
		}
		// A container that is still Waiting has never started and has no logs yet.
		if cs.State.Waiting != nil {
			return ErrContainerNotRunning
		}
		return nil
	}

	// Search the regular container statuses for the target container.
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Name != containerName {
			continue
		}
		return checkStatus(cs)
	}

	// Search the init container statuses for the target container (e.g. an
	// istio-proxy native sidecar is an init container).
	for _, cs := range pod.Status.InitContainerStatuses {
		if cs.Name != containerName {
			continue
		}
		return checkStatus(cs)
	}

	return ErrContainerNotRunning
}
