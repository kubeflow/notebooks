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
	"fmt"
	"io"
	"strings"

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
	ErrContainerNotFound    = fmt.Errorf("container not found in pod")
	ErrContainerNotRunning  = fmt.Errorf("container has not started yet")
	ErrPreviousLogsNotFound = fmt.Errorf("no logs found for the previous container instance")
)

var (
	// safeLimitBytes is the maximum number of bytes the Kubernetes API will return
	// for a single log request, bounding the size of the proxied stream.
	safeLimitBytes = int64(100 * 1024 * 1024) // 100 MB
	// defaultTailLines is the default number of lines to retrieve from the end of the logs.
	defaultTailLines = int64(1000)
)

type LogsRepository struct {
	cfg       *config.EnvConfig
	client    client.Client
	clientset kubernetes.Interface
}

func NewLogsRepository(cfg *config.EnvConfig, cl client.Client, clientset kubernetes.Interface) *LogsRepository {
	return &LogsRepository{
		cfg:       cfg,
		client:    cl,
		clientset: clientset,
	}
}

func (r *LogsRepository) OpenLogStream(ctx context.Context, namespace, workspaceName string, opts *models.LogOptions) (io.ReadCloser, error) {
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
		// When previous=true but the container has never restarted, the Kubernetes
		// API returns a 400 with a "previous terminated container ... not found"
		// message. Surface this as a semantic error instead of a generic 500.
		if opts.Previous && apierrors.IsBadRequest(err) && strings.Contains(err.Error(), "previous terminated container") {
			return nil, ErrPreviousLogsNotFound
		}
		return nil, fmt.Errorf("failed to open log stream for pod %s, container %s: %w", podName, containerName, err)
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

func (r *LogsRepository) resolvePodAndContainer(ctx context.Context, namespace, workspaceName string, opts *models.LogOptions) (string, string, error) {
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
		// None requested: default to the primary (first regular) container.
		if len(podStatus.Containers) == 0 {
			return "", "", ErrContainerNotRunning
		}
		containerName = podStatus.Containers[0].Name
	}

	// When requesting current (not previous) logs, ensure the target container has
	// actually started by inspecting the live Pod status. A container still in the
	// Waiting state (e.g. PodInitializing, ContainerCreating, ImagePullBackOff) has
	// no current log stream yet, and the Kubernetes API would return an opaque error;
	// surface it as a semantic 409 instead. Previous logs are exempt, since a
	// terminated instance can have logs even while the current instance is Waiting.
	if !opts.Previous {
		if err := r.ensureContainerStarted(ctx, namespace, podName, containerName); err != nil {
			return "", "", err
		}
	}

	return podName, containerName, nil
}

// ensureContainerStarted checks the live Pod status and returns ErrContainerNotRunning
// if the target container is still in the Waiting state (i.e. it has not started yet
// and therefore has no logs available for the current instance).
func (r *LogsRepository) ensureContainerStarted(ctx context.Context, namespace, podName, containerName string) error {
	pod, err := r.clientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			// The Workspace status references a pod that no longer exists.
			return ErrPodNotRunning
		}
		return fmt.Errorf("failed to get pod %s: %w", podName, err)
	}

	// Search both regular and init container statuses for the target container.
	for _, group := range [][]corev1.ContainerStatus{pod.Status.ContainerStatuses, pod.Status.InitContainerStatuses} {
		for _, cs := range group {
			if cs.Name != containerName {
				continue
			}
			// A container that is still Waiting has never started and has no logs yet.
			if cs.State.Waiting != nil {
				return ErrContainerNotRunning
			}
			return nil
		}
	}

	return ErrContainerNotRunning
}
