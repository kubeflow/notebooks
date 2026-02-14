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
	storagev1 "k8s.io/api/storage/v1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	scModels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/storageclasses"
)

// NewPVCCreateModelFromPVC creates a new PVCCreate model from a PersistentVolumeClaim object.
func NewPVCCreateModelFromPVC(pvc *corev1.PersistentVolumeClaim) *PVCCreate {
	return &PVCCreate{
		Name:             pvc.Name,
		AccessModes:      accessModesToStrings(pvc.Spec.AccessModes),
		StorageClassName: ptr.Deref(pvc.Spec.StorageClassName, ""),
		Requests: StorageRequests{
			Storage: pvc.Spec.Resources.Requests.Storage().String(),
		},
	}
}

// NewPVCListItemFromPVC creates a new PVCListItem model from a PersistentVolumeClaim object.
// The pods parameter is the list of pods that mount this PVC.
// The workspaces parameter is the list of workspaces that reference this PVC.
// The pv parameter is the bound PersistentVolume, if it exists.
// The sc parameter is the StorageClass of the bound PV, if it exists.
func NewPVCListItemFromPVC(pvc *corev1.PersistentVolumeClaim, pods []corev1.Pod, workspaces []kubefloworgv1beta1.Workspace, pv *corev1.PersistentVolume, sc *storagev1.StorageClass) PVCListItem {
	return PVCListItem{
		Name:       pvc.Name,
		CanMount:   pvc.Labels[common.LabelCanMount] == "true",
		CanUpdate:  pvc.Labels[common.LabelCanUpdate] == "true",
		Pods:       buildPVCPods(pods),
		Workspaces: buildPVCWorkspaces(workspaces),
		Audit:      common.NewAuditFromObjectMeta(&pvc.ObjectMeta),
		PVCSpec: PVCSpec{
			Requests: StorageRequests{
				Storage: pvc.Spec.Resources.Requests.Storage().String(),
			},
			AccessModes:      accessModesToStrings(pvc.Spec.AccessModes),
			StorageClassName: ptr.Deref(pvc.Spec.StorageClassName, ""),
			VolumeMode:       string(ptr.Deref(pvc.Spec.VolumeMode, "")),
		},
		PV: buildPVInfo(pv, sc),
	}
}

// buildPVCPods creates a list of PVCPod models from pods that mount the PVC.
func buildPVCPods(pods []corev1.Pod) []PVCPod {
	pvcPods := make([]PVCPod, len(pods))
	for i := range pods {
		pod := &pods[i]
		pvcPod := PVCPod{
			Name:  pod.Name,
			Phase: string(pod.Status.Phase),
		}
		if pod.Spec.NodeName != "" {
			pvcPod.Node = &PodNode{
				Name: pod.Spec.NodeName,
			}
		}
		pvcPods[i] = pvcPod
	}

	return pvcPods
}

// buildPVCWorkspaces creates a list of PVCWorkspace models from workspaces that reference the PVC.
func buildPVCWorkspaces(workspaces []kubefloworgv1beta1.Workspace) []PVCWorkspace {
	pvcWorkspaces := make([]PVCWorkspace, len(workspaces))
	for i := range workspaces {
		ws := &workspaces[i]
		pvcWorkspace := PVCWorkspace{
			Name:         ws.Name,
			State:        string(ws.Status.State),
			StateMessage: ws.Status.StateMessage,
		}
		if ws.Status.PodTemplatePod.Name != "" {
			pvcWorkspace.PodTemplatePod = &PodTemplatePod{
				Name: ws.Status.PodTemplatePod.Name,
			}
		}
		pvcWorkspaces[i] = pvcWorkspace
	}

	return pvcWorkspaces
}

// buildPVInfo creates a PVInfo model from a PersistentVolume and its StorageClass.
// Returns nil if the PV does not exist (e.g., PVC is not yet bound).
func buildPVInfo(pv *corev1.PersistentVolume, sc *storagev1.StorageClass) *PVInfo {
	if !pvExists(pv) {
		return nil
	}

	pvInfo := &PVInfo{
		Name:                          pv.Name,
		PersistentVolumeReclaimPolicy: string(pv.Spec.PersistentVolumeReclaimPolicy),
		VolumeMode:                    string(ptr.Deref(pv.Spec.VolumeMode, "")),
		AccessModes:                   accessModesToStrings(pv.Spec.AccessModes),
	}

	// populate storage class info if the StorageClass exists
	if scExists(sc) {
		pvInfo.StorageClass = &PVStorageClass{
			Name:        sc.Name,
			DisplayName: sc.Annotations[scModels.AnnotationDisplayName],
			Description: sc.Annotations[scModels.AnnotationDescription],
		}
	}

	return pvInfo
}

// accessModesToStrings converts a slice of PersistentVolumeAccessMode to a slice of strings.
func accessModesToStrings(modes []corev1.PersistentVolumeAccessMode) []string {
	s := make([]string, len(modes))
	for i, m := range modes {
		s[i] = string(m)
	}
	return s
}

func pvExists(pv *corev1.PersistentVolume) bool {
	return pv != nil && pv.UID != ""
}

func scExists(sc *storagev1.StorageClass) bool {
	return sc != nil && sc.UID != ""
}
