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

package workspaces

import (
	"context"
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

var ErrWorkspaceNotFound = fmt.Errorf("workspace not found")
var ErrRefWorkspaceKindNotExists = fmt.Errorf("referenced WorkspaceKind does not exist")

type WorkspaceRepository struct {
	client client.Client
}

func NewWorkspaceRepository(cl client.Client) *WorkspaceRepository {
	return &WorkspaceRepository{
		client: cl,
	}
}

func (r *WorkspaceRepository) GetWorkspace(ctx context.Context, namespace string, workspaceName string) (models.Workspace, error) {
	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return models.Workspace{}, ErrWorkspaceNotFound
		}
		return models.Workspace{}, err
	}

	// get workspace kind, if it exists
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	workspaceKindName := workspace.Spec.Kind
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		// ignore error if workspace kind does not exist, as we can still create a model without it
		if !apierrors.IsNotFound(err) {
			return models.Workspace{}, err
		}
	}

	// convert workspace to model
	workspaceModel := models.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)

	return workspaceModel, nil
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.Workspace, error) {
	// get all workspaces in the namespace
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	listOptions := []client.ListOption{
		client.InNamespace(namespace),
	}
	err := r.client.List(ctx, workspaceList, listOptions...)
	if err != nil {
		return nil, err
	}

	// convert workspaces to models
	workspacesModels := make([]models.Workspace, len(workspaceList.Items))
	for i, workspace := range workspaceList.Items {

		// get workspace kind, if it exists
		workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
		workspaceKindName := workspace.Spec.Kind
		if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
			// ignore error if workspace kind does not exist, as we can still create a model without it
			if !apierrors.IsNotFound(err) {
				return nil, err
			}
		}

		workspacesModels[i] = models.NewWorkspaceModelFromWorkspace(&workspace, workspaceKind)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.Workspace, error) {
	// get all workspaces in the cluster
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList); err != nil {
		return nil, err
	}

	// convert workspaces to models
	workspacesModels := make([]models.Workspace, len(workspaceList.Items))
	for i, workspace := range workspaceList.Items {

		// get workspace kind, if it exists
		workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
		workspaceKindName := workspace.Spec.Kind
		if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
			// ignore error if workspace kind does not exist, as we can still create a model without it
			if !apierrors.IsNotFound(err) {
				return nil, err
			}
		}

		workspacesModels[i] = models.NewWorkspaceModelFromWorkspace(&workspace, workspaceKind)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, workspaceModel *models.Workspace) (models.Workspace, error) {
	// get workspace kind
	// NOTE: if the referenced workspace kind does not exist,
	//       we throw an error because the api would reject the workspace creation
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	workspaceKindName := workspaceModel.WorkspaceKind.Name
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			return models.Workspace{}, fmt.Errorf("%w: %s", ErrRefWorkspaceKindNotExists, workspaceKindName)
		}
		return models.Workspace{}, err
	}

	// get data volumes from workspace model
	dataVolumeMounts := make([]kubefloworgv1beta1.PodVolumeMount, len(workspaceModel.PodTemplate.Volumes.Data))
	for i, dataVolume := range workspaceModel.PodTemplate.Volumes.Data {
		dataVolumeMounts[i] = kubefloworgv1beta1.PodVolumeMount{
			PVCName:   dataVolume.PvcName,
			MountPath: dataVolume.MountPath,
			ReadOnly:  ptr.To(dataVolume.ReadOnly),
		}
	}

	// define workspace object from model
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceModel.Name,
			Namespace: workspaceModel.Namespace,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:       &workspaceModel.Paused,
			DeferUpdates: &workspaceModel.DeferUpdates,
			Kind:         workspaceKindName,
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
					Labels:      workspaceModel.PodTemplate.PodMetadata.Labels,
					Annotations: workspaceModel.PodTemplate.PodMetadata.Annotations,
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
					Home: &workspaceModel.PodTemplate.Volumes.Home.PvcName,
					Data: dataVolumeMounts,
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: workspaceModel.PodTemplate.Options.ImageConfig.Current.Id,
					PodConfig:   workspaceModel.PodTemplate.Options.PodConfig.Current.Id,
				},
			},
		},
	}

	// create workspace
	if err := r.client.Create(ctx, workspace); err != nil {
		return models.Workspace{}, err
	}

	// convert the created workspace to a model
	createdWorkspaceModel := models.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)

	return createdWorkspaceModel, nil
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
