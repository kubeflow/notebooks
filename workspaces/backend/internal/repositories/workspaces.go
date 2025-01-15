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
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return models.WorkspaceModel{}, ErrWorkspaceNotFound
		}
		return models.WorkspaceModel{}, err
	}

	kind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspace.Spec.Kind}, kind); err != nil {
		return models.WorkspaceModel{}, err
	}

	return NewWorkspaceModelFromWorkspace(workspace, kind), nil
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
		kind := &kubefloworgv1beta1.WorkspaceKind{}
		if err := r.client.Get(ctx, client.ObjectKey{Name: item.Spec.Kind}, kind); err != nil {
			return nil, err
		}
		workspacesModels[i] = NewWorkspaceModelFromWorkspace(&item, kind)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.WorkspaceModel, error) {
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList); err != nil {
		return nil, err
	}

	workspacesModels := make([]models.WorkspaceModel, len(workspaceList.Items))
	for i, item := range workspaceList.Items {
		kind := &kubefloworgv1beta1.WorkspaceKind{}
		if err := r.client.Get(ctx, client.ObjectKey{Name: item.Spec.Kind}, kind); err != nil {
			return nil, err
		}
		workspacesModels[i] = NewWorkspaceModelFromWorkspace(&item, kind)
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
			Labels:      workspaceModel.PodTemplate.PodMetadata.Labels,
			Annotations: workspaceModel.PodTemplate.PodMetadata.Annotations,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:       &workspaceModel.Paused,
			DeferUpdates: &workspaceModel.DeferUpdates,
			// TODO: verify if workspace kind exists on validation
			Kind: workspaceModel.WorkspaceKind.Name,
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
					Labels:      workspaceModel.PodTemplate.PodMetadata.Labels,
					Annotations: workspaceModel.PodTemplate.PodMetadata.Annotations,
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
					Home: &workspaceModel.PodTemplate.Volumes.Home.PvcName,
					Data: []kubefloworgv1beta1.PodVolumeMount{},
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: workspaceModel.PodTemplate.ImageConfig.Current,
					PodConfig:   workspaceModel.PodTemplate.PodConfig.Current,
				},
			},
		},
	}

	// TODO: create data volumes if necessary
	workspace.Spec.PodTemplate.Volumes.Data = make([]kubefloworgv1beta1.PodVolumeMount, len(workspaceModel.PodTemplate.Volumes.Data))
	for i, dataVolume := range workspaceModel.PodTemplate.Volumes.Data {
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

	kind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspace.Spec.Kind}, kind); err != nil {
		return models.WorkspaceModel{}, err
	}

	return NewWorkspaceModelFromWorkspace(workspace, kind), nil
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

func NewWorkspaceModelFromWorkspace(item *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) models.WorkspaceModel {
	dataVolumes := make([]models.DataVolumeModel, len(item.Spec.PodTemplate.Volumes.Data))
	for i, volume := range item.Spec.PodTemplate.Volumes.Data {
		dataVolumes[i] = models.DataVolumeModel{
			PvcName:   volume.PVCName,
			MountPath: volume.MountPath,
			ReadOnly:  *volume.ReadOnly,
		}
	}

	imageConfigRedirectChain := make([]*models.RedirectChain, len(item.Status.PodTemplateOptions.ImageConfig.RedirectChain))
	for i, chain := range item.Status.PodTemplateOptions.ImageConfig.RedirectChain {
		imageConfigRedirectChain[i] = &models.RedirectChain{
			Source: chain.Source,
			Target: chain.Target,
		}
	}

	podConfigRedirectChain := make([]*models.RedirectChain, len(item.Status.PodTemplateOptions.PodConfig.RedirectChain))

	for i, chain := range item.Status.PodTemplateOptions.PodConfig.RedirectChain {
		podConfigRedirectChain[i] = &models.RedirectChain{
			Source: chain.Source,
			Target: chain.Target,
		}
	}

	podMetadataLabels := item.Spec.PodTemplate.PodMetadata.Labels
	if podMetadataLabels == nil {
		podMetadataLabels = map[string]string{}
	}

	podMetadataAnnotations := item.Spec.PodTemplate.PodMetadata.Annotations
	if podMetadataAnnotations == nil {
		podMetadataAnnotations = map[string]string{}
	}

	workspaceModel := models.WorkspaceModel{
		Name:      item.ObjectMeta.Name,
		Namespace: item.Namespace,
		WorkspaceKind: models.WorkspaceKind{
			Name: item.Spec.Kind,
			Type: "POD_TEMPLATE",
		},
		DeferUpdates: *item.Spec.DeferUpdates,
		Paused:       *item.Spec.Paused,
		PausedTime:   item.Status.PauseTime,
		State:        string(item.Status.State),
		StateMessage: item.Status.StateMessage,
		PodTemplate: models.PodTemplate{
			PodMetadata: &models.PodMetadata{
				Labels:      podMetadataLabels,
				Annotations: podMetadataAnnotations,
			},
			Volumes: &models.Volumes{
				Home: &models.DataVolumeModel{
					PvcName:   *item.Spec.PodTemplate.Volumes.Home,
					MountPath: wsk.Spec.PodTemplate.VolumeMounts.Home,
					ReadOnly:  false, // From where to get this value?
				},
				Data: dataVolumes,
			},
			ImageConfig: &models.ImageConfig{
				Current:       item.Spec.PodTemplate.Options.ImageConfig,
				Desired:       item.Status.PodTemplateOptions.ImageConfig.Desired,
				RedirectChain: imageConfigRedirectChain,
			},
			PodConfig: &models.PodConfig{
				Current:       item.Spec.PodTemplate.Options.PodConfig,
				Desired:       item.Spec.PodTemplate.Options.PodConfig,
				RedirectChain: podConfigRedirectChain,
			},
		},
		Activity: models.Activity{
			LastActivity: item.Status.Activity.LastActivity,
			LastUpdate:   item.Status.Activity.LastUpdate,
			// TODO: update these fields when the last probe is implemented
			LastProbe: &models.Probe{
				StartTimeMs: 0,
				EndTimeMs:   0,
				Result:      "default_result",
				Message:     "default_message",
			},
		},
	}
	return workspaceModel
}
