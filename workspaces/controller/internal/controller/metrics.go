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

package controller

import (
	"github.com/prometheus/client_golang/prometheus"
	ctrlmetrics "sigs.k8s.io/controller-runtime/pkg/metrics"
)

var (
	workspaceKindWorkspaceCount = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "notebooks",
			Name:      "workspacekind_workspace_count",
			Help:      "Number of Workspace resources managed by each WorkspaceKind.",
		},
		[]string{"workspace_kind"},
	)

	workspaceKindImageConfigWorkspaceCount = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "notebooks",
			Name:      "workspacekind_image_config_workspace_count",
			Help:      "Number of Workspace resources using each imageConfig option, grouped by WorkspaceKind.",
		},
		[]string{"workspace_kind", "image_config"},
	)

	workspaceKindPodConfigWorkspaceCount = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "notebooks",
			Name:      "workspacekind_pod_config_workspace_count",
			Help:      "Number of Workspace resources using each podConfig option, grouped by WorkspaceKind.",
		},
		[]string{"workspace_kind", "pod_config"},
	)
)

func init() {
	ctrlmetrics.Registry.MustRegister(
		workspaceKindWorkspaceCount,
		workspaceKindImageConfigWorkspaceCount,
		workspaceKindPodConfigWorkspaceCount,
	)
}

// clearWorkspaceKindMetrics removes all metric time series for a deleted WorkspaceKind.
func clearWorkspaceKindMetrics(kindName string) {
	workspaceKindWorkspaceCount.DeleteLabelValues(kindName)
	workspaceKindImageConfigWorkspaceCount.DeletePartialMatch(prometheus.Labels{"workspace_kind": kindName})
	workspaceKindPodConfigWorkspaceCount.DeletePartialMatch(prometheus.Labels{"workspace_kind": kindName})
}
