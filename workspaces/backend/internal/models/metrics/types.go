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

package metrics

import (
	corev1 "k8s.io/api/core/v1"
)

type ErrorCode string

const (
	ErrorCodeMetricsAPINotAvailable ErrorCode = "METRICS_API_NOT_AVAILABLE"
	ErrorCodeWorkspaceNotRunning    ErrorCode = "WORKSPACE_NOT_RUNNING"
)

// WorkspaceResourceUsage represents the point-in-time, pod-level resource
// usage for a workspace.
type WorkspaceResourceUsage struct {
	// Error indicates why usage is unavailable. Absent means success.
	Error ErrorCode `json:"error,omitempty"`

	// Containers holds the per-container resource data, keyed by container name.
	// Absent when Error is present.
	Containers map[string]ContainerResourceUsage `json:"containers,omitempty"`
}

// ContainerResourceUsage holds live usage metrics from the Metrics Server
// and configured resource requirements from the pod spec for a single container.
type ContainerResourceUsage struct {
	// MetricsFromMetricsServer holds live usage metrics. It is nil when metrics
	// are pending (e.g., pod just started).
	MetricsFromMetricsServer *MetricsFromMetricsServer `json:"metricsFromMetricsServer,omitempty"`

	// Resources holds the configured resource requirements from the pod spec.
	Resources corev1.ResourceRequirements `json:"resources"`
}

// MetricsFromMetricsServer holds point-in-time usage metrics collected by the
// Kubernetes Metrics Server for a container.
type MetricsFromMetricsServer struct {
	// Timestamp is the RFC3339 timestamp of when the sample was collected.
	Timestamp string `json:"timestamp"`

	// Usage is the current resource consumption.
	Usage ResourceValues `json:"usage"`
}

// ResourceValues holds CPU and Memory quantities formatted as strings.
type ResourceValues struct {
	CPU    string `json:"cpu,omitempty"`
	Memory string `json:"memory,omitempty"`
}
