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

const UnknownHomeMountPath = "__UNKNOWN_HOME_MOUNT_PATH__"

type WorkspaceDetails struct {
	PodMetadata commonWorkspaces.PodMetadata `json:"podMetadata"`
	Volumes     WorkspaceDetailVolumes       `json:"volumes"`
	Pod         *WorkspaceDetailPod          `json:"pod,omitempty"`
}

type WorkspaceDetailVolumes struct {
	Home    *PodVolumeInfo  `json:"home"`
	Data    []PodVolumeInfo `json:"data,omitempty"`
	Secrets []PodSecretInfo `json:"secrets,omitempty"`
}

type WorkspaceDetailPod struct {
	Name           string                     `json:"name"`
	NodeName       string                     `json:"nodeName"`
	Containers     []WorkspaceDetailContainer `json:"containers,omitempty"`
	InitContainers []WorkspaceDetailContainer `json:"initContainers,omitempty"`
}

type WorkspaceDetailContainer struct {
	Name string `json:"name"`
}

type PodVolumeInfo struct {
	PVCName   string `json:"pvcName"`
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly"`
}

type PodSecretInfo struct {
	SecretName  string `json:"secretName"`
	MountPath   string `json:"mountPath"`
	DefaultMode int32  `json:"defaultMode,omitempty"`
}
