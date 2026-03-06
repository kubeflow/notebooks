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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// PVCListItem represents a PVC in the list response with comprehensive metadata
type PVCListItem struct {
	Name       string          `json:"name"`
	CanMount   bool            `json:"canMount"`
	CanUpdate  bool            `json:"canUpdate"`
	Pods       []PodInfo       `json:"pods"`
	Workspaces []WorkspaceInfo `json:"workspaces"`
	Audit      common.Audit    `json:"audit"`
	PVCSpec    PVCSpec         `json:"pvcSpec"`

	// This field is nil until a PV is bound to the PVC.
	// https://kubernetes.io/docs/concepts/storage/persistent-volumes/#binding
	PV *PVInfo `json:"pv,omitempty"`
}

// PodInfo represents a pod that mounts the volume
type PodInfo struct {
	Name  string          `json:"name"`
	Phase corev1.PodPhase `json:"phase"`
	Node  *PodNode        `json:"node,omitempty"`
}

// PodNode represents the node where a Pod is scheduled.
type PodNode struct {
	Name string `json:"name"`
}

// WorkspaceInfo represents a workspace consuming the volume
type WorkspaceInfo struct {
	Name           string                            `json:"name"`
	State          kubefloworgv1beta1.WorkspaceState `json:"state"`
	StateMessage   string                            `json:"stateMessage"`
	PodTemplatePod *PodTemplatePod                   `json:"podTemplatePod,omitempty"`
}

// PodTemplatePod correlates a workspace to its pod
type PodTemplatePod struct {
	Name string   `json:"name"`
	Node *PodNode `json:"node,omitempty"`
}

// PVCSpec represents the PVC spec fields
type PVCSpec struct {
	Requests    StorageRequests                     `json:"requests"`
	AccessModes []corev1.PersistentVolumeAccessMode `json:"accessModes"`
	VolumeMode  corev1.PersistentVolumeMode         `json:"volumeMode"`

	// This field may be an empty string in two cases:
	// 1. The PVC is requesting the default storage class, and it has not been bound to a PV yet.
	// 2. The PVC is explicitly requesting a PV with no storage class (i.e. manual or out-of-band binding).
	StorageClassName string `json:"storageClassName"`
}

// StorageRequests represents storage size requests
type StorageRequests struct {
	Storage string `json:"storage"`
}

// PVInfo represents the bound PersistentVolume information
type PVInfo struct {
	Name                          string                               `json:"name"`
	PersistentVolumeReclaimPolicy corev1.PersistentVolumeReclaimPolicy `json:"persistentVolumeReclaimPolicy"`
	VolumeMode                    corev1.PersistentVolumeMode          `json:"volumeMode"`
	AccessModes                   []corev1.PersistentVolumeAccessMode  `json:"accessModes"`

	// This field should only be nil if the bound PV does not have a storage class (i.e. manual or out-of-band binding).
	StorageClass *StorageClassInfo `json:"storageClass,omitempty"`
}

// StorageClassInfo represents the storage class info from the bound PV
type StorageClassInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}
