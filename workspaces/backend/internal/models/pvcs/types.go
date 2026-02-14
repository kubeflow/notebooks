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

package pvcs

import (
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// PVCListItem represents a PVC in the list response with comprehensive metadata
type PVCListItem struct {
	Name       string         `json:"name"`
	CanMount   bool           `json:"canMount"`
	CanUpdate  bool           `json:"canUpdate"`
	Pods       []PVCPod       `json:"pods"`
	Workspaces []PVCWorkspace `json:"workspaces"`
	Audit      common.Audit   `json:"audit"`
	PVCSpec    PVCSpec        `json:"pvcSpec"`
	PV         *PVInfo        `json:"pv,omitempty"`
}

// PVCPod represents a pod that mounts the volume
type PVCPod struct {
	Name  string   `json:"name"`
	Phase string   `json:"phase"`
	Node  *PodNode `json:"node,omitempty"`
}

// PodNode represents a node where a pod is running
type PodNode struct {
	Name string `json:"name"`
}

// PVCWorkspace represents a workspace consuming the volume
type PVCWorkspace struct {
	Name           string          `json:"name"`
	State          string          `json:"state"`
	StateMessage   string          `json:"stateMessage"`
	PodTemplatePod *PodTemplatePod `json:"podTemplatePod,omitempty"`
}

// PodTemplatePod correlates a workspace to its pod
type PodTemplatePod struct {
	Name string `json:"name"`
}

// PVCSpec represents the PVC spec fields
type PVCSpec struct {
	Requests         StorageRequests `json:"requests"`
	AccessModes      []string        `json:"accessModes"`
	StorageClassName string          `json:"storageClassName"`
	VolumeMode       string          `json:"volumeMode"`
}

// StorageRequests represents storage size requests
type StorageRequests struct {
	Storage string `json:"storage"`
}

// PVInfo represents the bound PersistentVolume information
type PVInfo struct {
	Name                          string          `json:"name"`
	PersistentVolumeReclaimPolicy string          `json:"persistentVolumeReclaimPolicy"`
	StorageClass                  *PVStorageClass `json:"storageClass,omitempty"`
	VolumeMode                    string          `json:"volumeMode"`
	AccessModes                   []string        `json:"accessModes"`
}

// PVStorageClass represents the storage class info from the bound PV
type PVStorageClass struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}
