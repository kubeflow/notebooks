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

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/pvcs"
)

var (
	ErrPVCNotFound      = errors.New("PVC not found")
	ErrPVCAlreadyExists = errors.New("PVC already exists")
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
	pvcToPods := buildPVCToPodMap(podList)

	// list all workspaces in the namespace and build a map of PVC name to workspaces that reference it
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	err = r.client.List(ctx, workspaceList, client.InNamespace(namespace))
	if err != nil {
		return nil, err
	}
	pvcToWorkspaces := buildPVCToWorkspaceMap(workspaceList)

	// convert PVCs to models
	pvcModels := make([]models.PVCListItem, len(pvcList.Items))
	for i := range pvcList.Items {
		pvc := &pvcList.Items[i]

		// get pods that mount this PVC
		pods := pvcToPods[pvc.Name]

		// get workspaces that reference this PVC
		workspaces := pvcToWorkspaces[pvc.Name]

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

		// get StorageClass of the bound PV, if it exists
		sc := &storagev1.StorageClass{}
		if pv.UID != "" && pv.Spec.StorageClassName != "" {
			if err := r.client.Get(ctx, client.ObjectKey{Name: pv.Spec.StorageClassName}, sc); err != nil {
				// ignore error if StorageClass does not exist, as we can still create a model without it
				if !apierrors.IsNotFound(err) {
					return nil, err
				}
			}
		}

		pvcModels[i] = models.NewPVCListItemFromPVC(pvc, pods, workspaces, pv, sc)
	}

	return pvcModels, nil
}

// buildPVCToPodMap creates a map of PVC name to pods that mount it.
// This allows O(1) lookup of pods per PVC instead of scanning pods for each PVC.
func buildPVCToPodMap(podList *corev1.PodList) map[string][]corev1.Pod {
	pvcToPods := make(map[string][]corev1.Pod)
	for i := range podList.Items {
		pod := podList.Items[i]
		for _, volume := range pod.Spec.Volumes {
			if volume.PersistentVolumeClaim != nil {
				pvcName := volume.PersistentVolumeClaim.ClaimName
				pvcToPods[pvcName] = append(pvcToPods[pvcName], pod)
			}
		}
	}
	return pvcToPods
}

// buildPVCToWorkspaceMap creates a map of PVC name to workspaces that reference it.
// A workspace references PVCs through its home volume and data volumes.
// This allows O(1) lookup of workspaces per PVC instead of scanning workspaces for each PVC.
func buildPVCToWorkspaceMap(workspaceList *kubefloworgv1beta1.WorkspaceList) map[string][]kubefloworgv1beta1.Workspace {
	pvcToWorkspaces := make(map[string][]kubefloworgv1beta1.Workspace)
	for i := range workspaceList.Items {
		ws := workspaceList.Items[i]

		// check home volume
		if ws.Spec.PodTemplate.Volumes.Home != nil {
			pvcName := *ws.Spec.PodTemplate.Volumes.Home
			pvcToWorkspaces[pvcName] = append(pvcToWorkspaces[pvcName], ws)
		}

		// check data volumes
		for _, dataVolume := range ws.Spec.PodTemplate.Volumes.Data {
			pvcToWorkspaces[dataVolume.PVCName] = append(pvcToWorkspaces[dataVolume.PVCName], ws)
		}
	}
	return pvcToWorkspaces
}

func (r *PVCRepository) CreatePVC(ctx context.Context, pvcCreate *models.PVCCreate, namespace string) (*models.PVCCreate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"

	// get access modes from model
	accessModes := make([]corev1.PersistentVolumeAccessMode, len(pvcCreate.AccessModes))
	for i, mode := range pvcCreate.AccessModes {
		accessModes[i] = corev1.PersistentVolumeAccessMode(mode)
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
			AccessModes:      accessModes,
			StorageClassName: &pvcCreate.StorageClassName,
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: resource.MustParse(pvcCreate.Requests.Storage),
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
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      pvcName,
		},
	}

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
