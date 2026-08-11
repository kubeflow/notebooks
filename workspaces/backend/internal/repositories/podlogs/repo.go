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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
)

var (
	ErrWorkspaceNotFound    = fmt.Errorf("workspace not found")
	ErrPodNotRunning        = fmt.Errorf("workspace pod is not running")
	ErrContainerNotFound    = fmt.Errorf("container not found in workspace pod")
	ErrContainerNotRunning  = fmt.Errorf("container has not started yet")
	ErrPreviousLogsNotFound = fmt.Errorf("no logs found for the previous container instance")
)

// Format-string templates for wrapped errors.
const (
	fmtOpenLogStreamFailed = "failed to open log stream for pod %s, container %s: %w"
	fmtGetPodFailed        = "failed to get pod %s: %w"
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

// containerExists reports whether a container with the given name exists among the
// pod's regular or init containers. Both are valid log sources (e.g. an istio-proxy
// native sidecar is an init container).
func containerExists(name string, containers, initContainers []kubefloworgv1beta1.WorkspacePodContainer) bool {
	for _, c := range containers {
		if c.Name == name {
			return true
		}
	}
	for _, c := range initContainers {
		if c.Name == name {
			return true
		}
	}
	return false
}

func (r *PodLogsRepository) resolvePodAndContainer(ctx context.Context, namespace, workspaceName string, opts *models.LogOptions) (string, string, error) {
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return "", "", ErrWorkspaceNotFound
		}
		return "", "", err
	}

	podStatus := workspace.Status.PodTemplatePod
	podName := podStatus.Name
	if podName == "" {
		return "", "", ErrPodNotRunning
	}

	// Resolve the target container name.
	containerName := opts.Container
	if containerName != "" {
		// A requested container must exist among the pod's containers.
		if !containerExists(containerName, podStatus.Containers, podStatus.InitContainers) {
			return "", "", ErrContainerNotFound
		}
	} else {
		if len(podStatus.Containers) == 0 {
			return "", "", ErrContainerNotRunning
		}
		if !containerExists(primaryContainerName, podStatus.Containers, nil) {
			return "", "", ErrContainerNotFound
		}
		// None requested: default to the primary container, which the controller
		// hard-codes as "main".
		containerName = primaryContainerName
	}

	// Inspect the live Pod status to make a semantic decision before opening the
	// stream, so we can return a precise error instead of an opaque one from the
	// Kubernetes log API.
	if err := r.ensureLogsAvailable(ctx, namespace, podName, containerName, opts.Previous); err != nil {
		return "", "", err
	}

	return podName, containerName, nil
}

// ensureLogsAvailable checks the live Pod status for the target container and
// returns a semantic error when logs cannot be served:
//   - when previous is false and the container is still Waiting (never started),
//     it returns ErrContainerNotRunning.
//   - when previous is true and the container has no recorded previous terminated
//     instance (LastTerminationState.Terminated is nil), it returns
//     ErrPreviousLogsNotFound.
//
// The checker utilizes the clientset to fetch the live Pod status,
// which is more accurate than the Workspace's cached status.
func (r *PodLogsRepository) ensureLogsAvailable(ctx context.Context, namespace, podName, containerName string, previous bool) error {
	pod, err := r.clientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			// The Workspace status references a pod that no longer exists.
			return ErrPodNotRunning
		}
		return fmt.Errorf(fmtGetPodFailed, podName, err)
	}

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
