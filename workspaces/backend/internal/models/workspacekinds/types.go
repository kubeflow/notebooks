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

import "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"

type WorkspaceKind struct {
	Name               string             `json:"name"`
	DisplayName        string             `json:"displayName"`
	Description        string             `json:"description"`
	Deprecated         bool               `json:"deprecated"`
	DeprecationMessage string             `json:"deprecationMessage"`
	Hidden             bool               `json:"hidden"`
	Icon               ImageRef           `json:"icon"`
	Logo               ImageRef           `json:"logo"`
	ClusterMetrics     ClusterKindMetrics `json:"clusterMetrics"`
	PodTemplate        PodTemplate        `json:"podTemplate"`
}

type ClusterKindMetrics struct {
	Workspaces int32 `json:"workspacesCount"`
}

type ImageRef struct {
	URL string `json:"url"`
}

type PodTemplate struct {
	PodMetadata  PodMetadata     `json:"podMetadata"`
	VolumeMounts PodVolumeMounts `json:"volumeMounts"`

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
