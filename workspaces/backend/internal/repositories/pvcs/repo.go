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
	"context"
	"errors"
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/pvcs"
)

var (
	ErrPVCNotFound      = errors.New("PVC not found")
	ErrPVCAlreadyExists = errors.New("PVC already exists")
	ErrPVCNotCanUpdate  = fmt.Errorf("PVC cannot be modified because it is not labeled with %s=true", modelsCommon.LabelCanUpdate)
)

type PVCRepository struct {
	client client.Client
}

func NewPVCRepository(cl client.Client) *PVCRepository {
	return &PVCRepository{
		client: cl,
	}
}

func (r *PVCRepository) GetPVCs(ctx context.Context, namespace string) ([]models.PVCListItem, error) {
	// get all PVCs in the namespace
	pvcList := &corev1.PersistentVolumeClaimList{}
	listOptions := []client.ListOption{
		client.InNamespace(namespace),
	}
	err := r.client.List(ctx, pvcList, listOptions...)
	if err != nil {
		return nil, err
	}

	// list all pods in the namespace and build a map of PVC name to pods that mount it
	podList := &corev1.PodList{}
	err = r.client.List(ctx, podList, client.InNamespace(namespace))
	if err != nil {
		return nil, err
	}
	pvcToPodInfoList := buildPodInfoMap(podList)

	// list all workspaces in the namespace and build a map of PVC name to workspaces that reference it
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	err = r.client.List(ctx, workspaceList, client.InNamespace(namespace))
	if err != nil {
		return nil, err
	}
	pvcToWorkspaceInfoList := buildWorkspaceInfoMap(workspaceList)

	// convert PVCs to models
	pvcModels := make([]models.PVCListItem, len(pvcList.Items))
	for i := range pvcList.Items {
		pvc := &pvcList.Items[i]

		// get bound PV, if it exists
		pv := &corev1.PersistentVolume{}
		pvName := pvc.Spec.VolumeName
		if pvName != "" {
			if err := r.client.Get(ctx, client.ObjectKey{Name: pvName}, pv); err != nil {
				// ignore error if PV does not exist, as we can still create a model without it
				if !apierrors.IsNotFound(err) {
					return nil, err
				}
			}
		}

		// we use the PVC storage class name so that we can show the requested storage class in the UI, even if a PV is not yet bound.
		sc := &storagev1.StorageClass{}
		if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName != "" {
			if err := r.client.Get(ctx, client.ObjectKey{Name: *pvc.Spec.StorageClassName}, sc); err != nil {
				// ignore error if StorageClass does not exist, as we can still create a model without it
				if !apierrors.IsNotFound(err) {
					return nil, err
				}
			}
		}

		pvcModels[i] = models.NewPVCListItemFromPVC(pvc, pv, sc, pvcToPodInfoList, pvcToWorkspaceInfoList)
	}

	return pvcModels, nil
}

// buildPodInfoMap builds a map from PVC name to pods that mount it from a list of pods.
func buildPodInfoMap(podList *corev1.PodList) map[string][]models.PodInfo {
	pvcToPodInfo := make(map[string][]models.PodInfo)
	for i := range podList.Items {
		pod := podList.Items[i]
		podInfo := models.PodInfo{
			Name:  pod.Name,
			Phase: pod.Status.Phase,
		}
		if pod.Spec.NodeName != "" {
			podInfo.Node = &models.PodNode{
				Name: pod.Spec.NodeName,
			}
		}

		// a Pod may mount the same PVC multiple times, but we only want to include it once for each PVC
		seenPVCs := make(map[string]bool)

		for _, volume := range pod.Spec.Volumes {
			if volume.PersistentVolumeClaim != nil {
				pvcName := volume.PersistentVolumeClaim.ClaimName
				if !seenPVCs[pvcName] {
					pvcToPodInfo[pvcName] = append(pvcToPodInfo[pvcName], podInfo)
					seenPVCs[pvcName] = true
				}
			}
		}
	}
	return pvcToPodInfo
}

// buildWorkspaceInfoMap builds a map from PVC name to workspaces that mount it from a list of workspaces.
func buildWorkspaceInfoMap(workspaceList *kubefloworgv1beta1.WorkspaceList) map[string][]models.WorkspaceInfo {
	pvcToWsInfo := make(map[string][]models.WorkspaceInfo)
	for i := range workspaceList.Items {
		ws := workspaceList.Items[i]
		wsInfo := models.WorkspaceInfo{
			Name:         ws.Name,
			State:        ws.Status.State,
			StateMessage: ws.Status.StateMessage,
		}
		if ws.Status.PodTemplatePod.Name != "" {
			wsInfo.PodTemplatePod = &models.PodTemplatePod{
				Name: ws.Status.PodTemplatePod.Name,
			}
			if ws.Status.PodTemplatePod.NodeName != "" {
				wsInfo.PodTemplatePod.Node = &models.PodNode{
					Name: ws.Status.PodTemplatePod.NodeName,
				}
			}
		}

		// a Workspace may mount the same PVC multiple times, but we only want to include it once for each PVC
		seenPVCs := make(map[string]bool)

		// check home volume
		if ws.Spec.PodTemplate.Volumes.Home != nil {
			pvcName := *ws.Spec.PodTemplate.Volumes.Home
			if !seenPVCs[pvcName] {
				pvcToWsInfo[pvcName] = append(pvcToWsInfo[pvcName], wsInfo)
				seenPVCs[pvcName] = true
			}
		}

		// check data volumes
		for _, dataVolume := range ws.Spec.PodTemplate.Volumes.Data {
			pvcName := dataVolume.PVCName
			if !seenPVCs[pvcName] {
				pvcToWsInfo[pvcName] = append(pvcToWsInfo[pvcName], wsInfo)
				seenPVCs[pvcName] = true
			}
		}
	}
	return pvcToWsInfo
}

func (r *PVCRepository) CreatePVC(ctx context.Context, pvcCreate *models.PVCCreate, namespace string) (*models.PVCCreate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"

	var allValErrs field.ErrorList

	// get and validate the storage class
	scName := pvcCreate.StorageClassName
	scNameField := field.NewPath("storageClassName")
	valErrs, err := helper.ValidateKubernetesStorageClassIsUsable(ctx, r.client, scNameField, scName)
	if err != nil {
		return nil, err
	}
	allValErrs = append(allValErrs, valErrs...)

	// unpack the storage request quantity and validate it
	storageRequestString := pvcCreate.Requests.Storage
	storageRequestField := field.NewPath("requests").Child("storage")
	storageRequestQuantity, err := resource.ParseQuantity(storageRequestString)
	if err != nil {
		allValErrs = append(allValErrs, field.Invalid(storageRequestField, storageRequestString, err.Error()))
	}

	// if there are any validation errors at this point, return an aggregated error to the caller
	if len(allValErrs) > 0 {
		return nil, helper.NewInternalValidationError(allValErrs)
	}

	// define PVC object from model
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcCreate.Name,
			Namespace: namespace,
			Labels: map[string]string{
				modelsCommon.LabelCanMount:  "true",
				modelsCommon.LabelCanUpdate: "true",
			},
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes:      pvcCreate.AccessModes,
			StorageClassName: &scName,
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: storageRequestQuantity,
				},
			},
		},
	}

	// set audit annotations
	modelsCommon.UpdateObjectMetaForCreate(&pvc.ObjectMeta, actor)

	// create PVC
	if err := r.client.Create(ctx, pvc); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, ErrPVCAlreadyExists
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
	}

	createdPVCModel := models.NewPVCCreateModelFromPVC(pvc)
	return createdPVCModel, nil
}

func (r *PVCRepository) DeletePVC(ctx context.Context, namespace, pvcName string) error {
	// get and validate the current PVC from K8s
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      pvcName,
		},
	}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: pvcName}, pvc); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrPVCNotFound
		}
		return err
	}
	if pvc.Labels[modelsCommon.LabelCanUpdate] != "true" {
		return ErrPVCNotCanUpdate
	}

	//
	// TODO: consider failing if the PVC is currently in use by a Pod/Workspace
	//       this may help prevent users putting the PVC into a deleting state,
	//       which can not be easily undone.
	//

	// NOTE: if the PVC is in use by a pod, Kubernetes will accept the delete request
	//       but defer actual deletion until the PVC is no longer mounted (storage object in use protection)
	if err := r.client.Delete(ctx, pvc); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrPVCNotFound
		}
		return err
	}

	return nil
}
