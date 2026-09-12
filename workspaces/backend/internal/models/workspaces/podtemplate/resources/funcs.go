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

package resources

import (
	"time"

	corev1 "k8s.io/api/core/v1"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

// NewWorkspaceResourceUsage joins live per-container usage (from a metrics provider) with the
// requests/limits declared in the pod spec, producing the response for a workspace.
// usageByContainer is a map of container names to their MetricsFromMetricsServer for this pod.
func NewWorkspaceResourceUsage(pod *corev1.Pod, usageByContainer map[string]*MetricsFromMetricsServer) *WorkspaceResourceUsage {
	if pod == nil {
		return nil
	}

	containers := make(map[string]ContainerResourceUsage, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		metrics := usageByContainer[c.Name]
		containers[c.Name] = ContainerResourceUsage{
			MetricsFromMetricsServer: metrics,
			Resources:                c.Resources,
		}
	}

	return &WorkspaceResourceUsage{
		Containers: containers,
	}
}

// UsageForPod indexes the containers of the PodMetrics sample into a
// map of container name -> MetricsFromMetricsServer.
func UsageForPod(pm *metricsv1beta1.PodMetrics) map[string]*MetricsFromMetricsServer {
	if pm == nil {
		return nil
	}
	byContainer := make(map[string]*MetricsFromMetricsServer, len(pm.Containers))
	timestamp := pm.Timestamp.Format(time.RFC3339)
	for _, c := range pm.Containers {
		byContainer[c.Name] = &MetricsFromMetricsServer{
			Timestamp: timestamp,
			Usage:     resourceValues(c.Usage),
		}
	}
	return byContainer
}

func resourceValues(rl corev1.ResourceList) ResourceValues {
	var rv ResourceValues
	if cpu, ok := rl[corev1.ResourceCPU]; ok {
		rv.CPU = cpu.String()
	}
	if mem, ok := rl[corev1.ResourceMemory]; ok {
		rv.Memory = mem.String()
	}
	return rv
}
