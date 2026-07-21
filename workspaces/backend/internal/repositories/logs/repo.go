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
	"bufio"
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"

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
	// safeLimitBytes is the maximum number of bytes to read from the logs to avoid excessive memory usage.
	safeLimitBytes = int64(2 * 1024 * 1024) // 2 MB
	// Default number of lines to retrieve from the end of the logs.
	defaultTailLines = int64(1000)
	// maxScanTokenBytes is the maximum size of a token (line) that the scanner will read.
	maxScanTokenBytes = 1024 * 1024 // 1 MB
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

func (r *LogsRepository) GetWorkspaceLogs(ctx context.Context, namespace, workspaceName string, opts *models.LogOptions) (models.WorkspaceLogs, error) {
	podName, containerName, err := r.resolvePodAndContainer(ctx, namespace, workspaceName, opts)
	if err != nil {
		return nil, err
	}

	tail := opts.TailLines
	if tail <= 0 {
		tail = defaultTailLines
	}

	req := r.clientset.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
		Container:  containerName,
		TailLines:  &tail,
		LimitBytes: &safeLimitBytes,
		Previous:   opts.Previous,
		Follow:     false,
		Timestamps: true,
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
	defer stream.Close()

	var logs models.WorkspaceLogs
	err = scanLogLines(stream, func(line string) {
		logs = append(logs, line)
	})
	if err != nil {
		return nil, fmt.Errorf("failed to scan log lines for pod %s, container %s: %w", podName, containerName, err)
	}

	return logs, nil
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

	if opts.Container != "" {
		for _, c := range podStatus.Containers {
			if c.Name == opts.Container {
				return podName, opts.Container, nil
			}
		}
		return "", "", ErrContainerNotFound
	}

	if len(podStatus.Containers) > 0 {
		return podName, podStatus.Containers[0].Name, nil
	}

	return "", "", ErrContainerNotRunning
}

func scanLogLines(r io.Reader, emit func(line string)) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), maxScanTokenBytes)
	for scanner.Scan() {
		emit(scanner.Text())
	}
	return scanner.Err()
}
