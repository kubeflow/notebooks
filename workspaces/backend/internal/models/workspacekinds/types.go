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

package workspacekinds

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

type WorkspaceKindListItem struct {
	Name               string              `json:"name"`
	DisplayName        string              `json:"displayName"`
	Description        string              `json:"description"`
	Deprecated         bool                `json:"deprecated"`
	DeprecationMessage string              `json:"deprecationMessage"`
	Hidden             bool                `json:"hidden"`
	Icon               assets.ImageRef     `json:"icon"`
	Logo               assets.ImageRef     `json:"logo"`
	ClusterMetrics     ClusterKindMetrics  `json:"clusterMetrics"`
	PodTemplate        PodTemplate         `json:"podTemplate"`
	ActivityRules      []ActivityRule      `json:"activityRules,omitempty"`
	Restrictions       common.Restrictions `json:"restrictions"`
}

type ClusterKindMetrics struct {
	Workspaces int32 `json:"workspacesCount"`
}

type PodTemplate struct {
	PodMetadata   PodMetadata     `json:"podMetadata"`
	VolumeMounts  PodVolumeMounts `json:"volumeMounts"`
	ActivityProbe *ActivityProbe  `json:"activityProbe,omitempty"`

	//
	// TODO: remove once frontend migrates to the new listValues endpoint for both create/update and wsk admin views
	//
	Options options.PodTemplateOptions `json:"options"`
}

type PodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type PodVolumeMounts struct {
	Home string `json:"home"`
}

type ActivityProbe struct {
	MinProbeIntervalSeconds int32                 `json:"minProbeIntervalSeconds"`
	ProbeIntervalSeconds    int32                 `json:"probeIntervalSeconds"`
	PodExec                 *ActivityProbePodExec `json:"podExec,omitempty"`
	Jupyter                 *ActivityProbeJupyter `json:"jupyter,omitempty"`
}

type ActivityProbePodExec struct {
	TimeoutSeconds int32 `json:"timeoutSeconds"`
	// NOTE: Script is excluded from the WorkspaceKindListItem model for size reasons.
}

type ActivityProbeJupyter struct {
	LastActivity bool   `json:"lastActivity"`
	PortId       string `json:"portId"`
}

type ActivityRule struct {
	Config ActivityRuleConfig `json:"config"`
	Match  *ActivityRuleMatch `json:"match,omitempty"`
	Effect ActivityRuleEffect `json:"effect"`
}

type ActivityRuleConfig struct {
	SecondsSinceActive int32 `json:"secondsSinceActive"`
	MinRunningSeconds  int32 `json:"minRunningSeconds,omitempty"`
}

type ActivityRuleMatch struct {
	MatchNamespace *MatchNamespace `json:"matchNamespace,omitempty"`
	MatchPodConfig *MatchPodConfig `json:"matchPodConfig,omitempty"`
}

type MatchNamespace struct {
	Selector metav1.LabelSelector `json:"selector"`
}

type MatchPodConfig struct {
	Selector metav1.LabelSelector `json:"selector"`
}

type ActivityRuleEffect struct {
	PauseWorkspace bool `json:"pauseWorkspace"`
}
