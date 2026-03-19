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
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// NewPVCCreateModelFromPVC creates a new PVCCreate model from a PersistentVolumeClaim object.
func NewPVCCreateModelFromPVC(pvc *corev1.PersistentVolumeClaim) *PVCCreate {
	return &PVCCreate{
		Name:             pvc.Name,
		AccessModes:      pvc.Spec.AccessModes,
		StorageClassName: ptr.Deref(pvc.Spec.StorageClassName, ""),
		Requests: StorageRequestsMutate{
			Storage: pvc.Spec.Resources.Requests.Storage().String(),
		},
	}
}

// NewPVCListItemFromPVC creates a new PVCListItem model from a PersistentVolumeClaim object.
func NewPVCListItemFromPVC(pvc *corev1.PersistentVolumeClaim, pv *corev1.PersistentVolume, sc *storagev1.StorageClass, pvcToPodInfoList map[string][]PodInfo, pvcToWorkspaceInfoList map[string][]WorkspaceInfo) PVCListItem {

	// if the PV exists, build the PVInfo.
	// Note that the PV may not exist if the PVC is not yet bound.
	var pvInfo *PVInfo
	if pvExists(pv) {
		pvInfo = &PVInfo{
			Name:                          pv.Name,
			PersistentVolumeReclaimPolicy: pv.Spec.PersistentVolumeReclaimPolicy,
			VolumeMode:                    ptr.Deref(pv.Spec.VolumeMode, corev1.PersistentVolumeFilesystem),
			AccessModes:                   pv.Spec.AccessModes,
		}
		if scExists(sc) {
			scInfo := &StorageClassInfo{
				Name:        sc.Name,
				DisplayName: common.GetDisplayNameFromObjectMeta(&sc.ObjectMeta),
				Description: common.GetDescriptionFromObjectMeta(&sc.ObjectMeta),
			}
			pvInfo.StorageClass = scInfo
		}
	}

	// build the list of PodInfo for pods that mount this PVC, if any.
	podList := make([]PodInfo, 0)
	if pvcToPodInfoList[pvc.Name] != nil {
		podList = pvcToPodInfoList[pvc.Name]
	}

	// build the list of WorkspaceInfo for workspaces that reference this PVC, if any.
	workspaceList := make([]WorkspaceInfo, 0)
	if pvcToWorkspaceInfoList[pvc.Name] != nil {
		workspaceList = pvcToWorkspaceInfoList[pvc.Name]
	}

	return PVCListItem{
		Name:       pvc.Name,
		CanMount:   pvc.Labels[common.LabelCanMount] == "true",
		CanUpdate:  pvc.Labels[common.LabelCanUpdate] == "true",
		Pods:       podList,
		Workspaces: workspaceList,
		Audit:      common.NewAuditFromObjectMeta(&pvc.ObjectMeta),
		PVCSpec: PVCSpec{
			Requests: StorageRequests{
				Storage: pvc.Spec.Resources.Requests.Storage().String(),
			},
			AccessModes:      pvc.Spec.AccessModes,
			StorageClassName: ptr.Deref(pvc.Spec.StorageClassName, ""),
			VolumeMode:       ptr.Deref(pvc.Spec.VolumeMode, corev1.PersistentVolumeFilesystem),
		},
		//
		// TODO: move storage class info to the root, and remove it from PVInfo.
		//       this allows us to return storage class info even when the PV is not yet bound.
		//       also, remove StorageClassName from PVCSpec since it would be redundant.
		//
		PV: pvInfo,
	}
}

func pvExists(pv *corev1.PersistentVolume) bool {
	return pv != nil && pv.UID != ""
}

func scExists(sc *storagev1.StorageClass) bool {
	return sc != nil && sc.UID != ""
}
