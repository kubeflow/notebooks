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

package repositories

import (
	"context"
	"errors"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models"
)

var ErrWorkspaceNotFound = errors.New("workspace not found")

type WorkspaceRepository struct {
	client client.Client
}

func NewWorkspaceRepository(cl client.Client) *WorkspaceRepository {
	return &WorkspaceRepository{
		client: cl,
	}
}

func (r *WorkspaceRepository) GetWorkspace(ctx context.Context, namespace string, workspaceName string) (models.WorkspaceModel, error) {
	workspace := &kubefloworgv1beta1.Workspace{}
	err := r.client.Get(ctx, client.ObjectKey{
		Namespace: namespace,
		Name:      workspaceName,
	}, workspace)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return models.WorkspaceModel{}, ErrWorkspaceNotFound
		}
		return models.WorkspaceModel{}, err
	}

	workspaceModel := models.NewWorkspaceModelFromWorkspace(workspace)
	return workspaceModel, nil
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.WorkspaceModel, error) {
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	listOptions := []client.ListOption{
		client.InNamespace(namespace),
	}
	err := r.client.List(ctx, workspaceList, listOptions...)
	if err != nil {
		return nil, err
	}

	workspacesModels := make([]models.WorkspaceModel, len(workspaceList.Items))
	for i, item := range workspaceList.Items {
		workspaceModel := models.NewWorkspaceModelFromWorkspace(&item)
		workspacesModels[i] = workspaceModel
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.WorkspaceModel, error) {
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}

	err := r.client.List(ctx, workspaceList)
	if err != nil {
		return nil, err
	}

	workspacesModels := make([]models.WorkspaceModel, len(workspaceList.Items))
	for i, item := range workspaceList.Items {
		workspaceModel := models.NewWorkspaceModelFromWorkspace(&item)
		workspacesModels[i] = workspaceModel
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, workspaceModel *models.WorkspaceModel) (models.WorkspaceModel, error) {
	// TODO: review all fields
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceModel.Name,
			Namespace: workspaceModel.Namespace,
			// TODO: the pod and workspace labels should be separated
			Labels:      workspaceModel.Labels,
			Annotations: workspaceModel.Annotations,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:       &workspaceModel.Paused,
			DeferUpdates: &workspaceModel.DeferUpdates,
			// TODO: verify if workspace kind exists on validation
			Kind: workspaceModel.Kind,
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
					Labels:      workspaceModel.Labels,
					Annotations: workspaceModel.Annotations,
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
					Home: &workspaceModel.HomeVolume,
					Data: []kubefloworgv1beta1.PodVolumeMount{},
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: workspaceModel.ImageConfig,
					PodConfig:   workspaceModel.PodConfig,
				},
			},
		},
	}

	// TODO: create data volumes if necessary
	workspace.Spec.PodTemplate.Volumes.Data = make([]kubefloworgv1beta1.PodVolumeMount, len(workspaceModel.DataVolumes))
	for i, dataVolume := range workspaceModel.DataVolumes {
		// make a copy of readOnly because dataVolume is reassigned each loop
		readOnly := dataVolume.ReadOnly
		workspace.Spec.PodTemplate.Volumes.Data[i] = kubefloworgv1beta1.PodVolumeMount{
			PVCName:   dataVolume.PvcName,
			MountPath: dataVolume.MountPath,
			ReadOnly:  &readOnly,
		}
	}
	if err := r.client.Create(ctx, workspace); err != nil {
		return models.WorkspaceModel{}, err
	}

	return models.NewWorkspaceModelFromWorkspace(workspace), nil
}

func (r *WorkspaceRepository) DeleteWorkspace(ctx context.Context, namespace, workspaceName string) error {
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      workspaceName,
		},
	}

	if err := r.client.Delete(ctx, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrWorkspaceNotFound
		}
		return err
	}

	return nil
}
