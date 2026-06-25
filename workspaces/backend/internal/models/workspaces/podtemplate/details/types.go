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

package details

import (
	commonWorkspaces "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/common"
)

type WorkspaceDetails struct {
	PodMetadata commonWorkspaces.PodMetadata `json:"podMetadata"`
	Volumes     WorkspaceDetailVolumes       `json:"volumes"`
	Pod         *WorkspaceDetailPod          `json:"pod"`
}

type WorkspaceDetailVolumes struct {
	Home    *commonWorkspaces.PodVolumeInfo  `json:"home"`
	Data    []commonWorkspaces.PodVolumeInfo `json:"data,omitempty"`
	Secrets []commonWorkspaces.PodSecretInfo `json:"secrets,omitempty"`
}

type WorkspaceDetailPod struct {
	Name           string                     `json:"name"`
	NodeName       string                     `json:"nodeName"`
	Containers     []WorkspaceDetailContainer `json:"containers"`
	InitContainers []WorkspaceDetailContainer `json:"initContainers"`
}

type WorkspaceDetailContainer struct {
	Name string `json:"name"`
}
