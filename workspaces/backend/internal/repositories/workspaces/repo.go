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
	"encoding/json"
	"fmt"
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	modelsActions "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/actions"
)

var (
	ErrWorkspaceNotFound         = fmt.Errorf("workspace not found")
	ErrWorkspaceAlreadyExists    = fmt.Errorf("workspace already exists")
	ErrWorkspaceInvalidState     = fmt.Errorf("workspace is in an invalid state for this operation")
	ErrWorkspaceRevisionConflict = fmt.Errorf("current workspace revision does not match request")
)

type WorkspaceRepository struct {
	client client.Client
}

func NewWorkspaceRepository(cl client.Client) *WorkspaceRepository {
	return &WorkspaceRepository{
		client: cl,
	}
}

func (r *WorkspaceRepository) GetWorkspace(ctx context.Context, namespace string, workspaceName string) (*models.WorkspaceUpdate, error) {
	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}

	// convert workspace to WorkspaceUpdate model
	workspaceUpdateModel := models.NewWorkspaceUpdateModelFromWorkspace(workspace)

	return workspaceUpdateModel, nil
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.WorkspaceListItem, error) {
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
	workspacesModels := make([]models.WorkspaceListItem, len(workspaceList.Items))
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

		workspacesModels[i] = models.NewWorkspaceListItemFromWorkspace(&workspace, workspaceKind)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.WorkspaceListItem, error) {
	// get all workspaces in the cluster
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList); err != nil {
		return nil, err
	}

	// convert workspaces to models
	workspacesModels := make([]models.WorkspaceListItem, len(workspaceList.Items))
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

		workspacesModels[i] = models.NewWorkspaceListItemFromWorkspace(&workspace, workspaceKind)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, workspaceCreate *models.WorkspaceCreate, namespace string) (*models.WorkspaceCreate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"

	var allValErrs field.ErrorList

	// unpack and validate home volume
	homeVolumeName := workspaceCreate.PodTemplate.Volumes.Home
	homeVolumeNameField := field.NewPath("podTemplate", "volumes", "home")
	if homeVolumeName != nil {
		valErrs, err := helper.ValidateKubernetesPVCIsMountable(ctx, r.client, homeVolumeNameField, namespace, *homeVolumeName)
		if err != nil {
			return nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
	}

	// unpack and validate data volume mounts
	dataVolumeMounts := make([]kubefloworgv1beta1.PodVolumeMount, len(workspaceCreate.PodTemplate.Volumes.Data))
	for i, dataVolume := range workspaceCreate.PodTemplate.Volumes.Data {
		dataVolumeName := dataVolume.PVCName
		dataVolumeNameField := field.NewPath("podTemplate", "volumes", "data").Index(i).Child("pvcName")
		valErrs, err := helper.ValidateKubernetesPVCIsMountable(ctx, r.client, dataVolumeNameField, namespace, dataVolumeName)
		if err != nil {
			return nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
		dataVolumeMounts[i] = kubefloworgv1beta1.PodVolumeMount{
			PVCName:   dataVolumeName,
			MountPath: dataVolume.MountPath,
			ReadOnly:  ptr.To(dataVolume.ReadOnly),
		}
	}

	// unpack and validate secret mounts
	secretMounts := make([]kubefloworgv1beta1.PodSecretMount, len(workspaceCreate.PodTemplate.Volumes.Secrets))
	for i, secret := range workspaceCreate.PodTemplate.Volumes.Secrets {
		secretName := secret.SecretName
		secretNameField := field.NewPath("podTemplate", "volumes", "secrets").Index(i).Child("secretName")
		valErrs, err := helper.ValidateKubernetesSecretIsMountable(ctx, r.client, secretNameField, namespace, secretName)
		if err != nil {
			return nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
		secretMounts[i] = kubefloworgv1beta1.PodSecretMount{
			SecretName:  secretName,
			MountPath:   secret.MountPath,
			DefaultMode: secret.DefaultMode,
		}
	}

	// if there are any validation errors at this point, return an aggregated error to the caller
	if len(allValErrs) > 0 {
		return nil, helper.NewInternalValidationError(allValErrs)
	}

	// define workspace object from model
	workspaceName := workspaceCreate.Name
	workspaceKindName := workspaceCreate.Kind
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceName,
			Namespace: namespace,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused: &workspaceCreate.Paused,
			Kind:   workspaceKindName,
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
					Labels:      workspaceCreate.PodTemplate.PodMetadata.Labels,
					Annotations: workspaceCreate.PodTemplate.PodMetadata.Annotations,
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
					Home:    homeVolumeName,
					Data:    dataVolumeMounts,
					Secrets: secretMounts,
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: workspaceCreate.PodTemplate.Options.ImageConfig,
					PodConfig:   workspaceCreate.PodTemplate.Options.PodConfig,
				},
			},
		},
	}

	// set audit annotations
	modelsCommon.UpdateObjectMetaForCreate(&workspace.ObjectMeta, actor)

	// create workspace
	if err := r.client.Create(ctx, workspace); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, ErrWorkspaceAlreadyExists
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
	}

	createdWorkspaceModel := models.NewWorkspaceCreateModelFromWorkspace(workspace)
	return createdWorkspaceModel, nil
}

func (r *WorkspaceRepository) UpdateWorkspace(ctx context.Context, workspaceUpdate *models.WorkspaceUpdate, namespace, workspaceName string) (*models.WorkspaceUpdate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"
	now := time.Now()

	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}

	// ensure caller's revision matches current workspace revision
	// prevents updates by callers with a stale view of the workspace
	clusterRevision := models.CalculateWorkspaceRevision(workspace)
	callerRevision := workspaceUpdate.Revision
	if clusterRevision != callerRevision {
		return nil, ErrWorkspaceRevisionConflict
	}

	// NOTE: currently all Workspaces are "podTemplate"-type, if other types are
	//       introduced in the future, this logic will need to be updated.

	var allValErrs field.ErrorList

	// unpack and validate home volume
	homeVolumeName := workspaceUpdate.PodTemplate.Volumes.Home
	homeVolumeNameField := field.NewPath("podTemplate", "volumes", "home")
	if homeVolumeName != nil {
		valErrs, err := helper.ValidateKubernetesPVCIsMountable(ctx, r.client, homeVolumeNameField, namespace, *homeVolumeName)
		if err != nil {
			return nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
	}

	// unpack and validate data volume mounts
	dataVolumeMounts := make([]kubefloworgv1beta1.PodVolumeMount, len(workspaceUpdate.PodTemplate.Volumes.Data))
	for i, dataVolume := range workspaceUpdate.PodTemplate.Volumes.Data {
		dataVolumeName := dataVolume.PVCName
		dataVolumeNameField := field.NewPath("podTemplate", "volumes", "data").Index(i).Child("pvcName")
		valErrs, err := helper.ValidateKubernetesPVCIsMountable(ctx, r.client, dataVolumeNameField, namespace, dataVolumeName)
		if err != nil {
			return nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
		dataVolumeMounts[i] = kubefloworgv1beta1.PodVolumeMount{
			PVCName:   dataVolumeName,
			MountPath: dataVolume.MountPath,
			ReadOnly:  ptr.To(dataVolume.ReadOnly),
		}
	}

	// unpack and validate secret mounts
	secretMounts := make([]kubefloworgv1beta1.PodSecretMount, len(workspaceUpdate.PodTemplate.Volumes.Secrets))
	for i, secret := range workspaceUpdate.PodTemplate.Volumes.Secrets {
		secretName := secret.SecretName
		secretNameField := field.NewPath("podTemplate", "volumes", "secrets").Index(i).Child("secretName")
		valErrs, err := helper.ValidateKubernetesSecretIsMountable(ctx, r.client, secretNameField, namespace, secretName)
		if err != nil {
			return nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
		secretMounts[i] = kubefloworgv1beta1.PodSecretMount{
			SecretName:  secretName,
			MountPath:   secret.MountPath,
			DefaultMode: secret.DefaultMode,
		}
	}

	// if there are any validation errors at this point, return an aggregated error to the caller
	if len(allValErrs) > 0 {
		return nil, helper.NewInternalValidationError(allValErrs)
	}

	// apply model fields to workspace spec
	workspace.Spec.Paused = ptr.To(workspaceUpdate.Paused)
	workspace.Spec.PodTemplate = kubefloworgv1beta1.WorkspacePodTemplate{
		PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
			Labels:      workspaceUpdate.PodTemplate.PodMetadata.Labels,
			Annotations: workspaceUpdate.PodTemplate.PodMetadata.Annotations,
		},
		Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
			Home:    workspaceUpdate.PodTemplate.Volumes.Home,
			Data:    dataVolumeMounts,
			Secrets: secretMounts,
		},
		Options: kubefloworgv1beta1.WorkspacePodOptions{
			ImageConfig: workspaceUpdate.PodTemplate.Options.ImageConfig,
			PodConfig:   workspaceUpdate.PodTemplate.Options.PodConfig,
		},
	}

	// set audit annotations
	modelsCommon.UpdateObjectMetaForUpdate(&workspace.ObjectMeta, actor, now)

	// TODO: if the update fails due to a kubernetes conflict, this implies our cache is stale.
	//       we should wrap this operation in retry.RetryOnConflict to retry the entire update
	//       (including re-fetching and recalculating clusterRevision) before returning a 500
	//       error to the caller (DO NOT return a 409, as it's not the caller's fault)
	if err := r.client.Update(ctx, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceNotFound
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, fmt.Errorf("failed to update workspace: %w", err)
	}

	workspaceUpdateModel := models.NewWorkspaceUpdateModelFromWorkspace(workspace)
	return workspaceUpdateModel, nil
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

// WorkspacePatchOperation represents a single JSONPatch operation
type WorkspacePatchOperation struct {
	Op    string      `json:"op"`
	Path  string      `json:"path"`
	Value interface{} `json:"value,omitempty"`
}

// HandlePauseAction handles pause/start operations for a workspace
func (r *WorkspaceRepository) HandlePauseAction(ctx context.Context, namespace, workspaceName string, workspaceActionPause *modelsActions.WorkspaceActionPause) (*modelsActions.WorkspaceActionPause, error) {
	targetPauseState := workspaceActionPause.Paused

	// Build patch operations incrementally
	patch := []WorkspacePatchOperation{
		{
			Op:    "test",
			Path:  "/spec/paused",
			Value: !targetPauseState, // Test current state (opposite of target state)
		},
	}

	// For start operations, add additional test for paused state
	// "test" operations on JSON Patch only support strict equality checks, so we can't apply an additional test
	// for pause operations on the workspace as we'd want to check the workspace state != paused.
	if !targetPauseState {
		patch = append(patch, WorkspacePatchOperation{
			Op:    "test",
			Path:  "/status/state",
			Value: kubefloworgv1beta1.WorkspaceStatePaused,
		})
	}

	// Always add the replace operation
	patch = append(patch, WorkspacePatchOperation{
		Op:    "replace",
		Path:  "/spec/paused",
		Value: targetPauseState,
	})

	patchBytes, err := json.Marshal(patch)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal patch: %w", err)
	}

	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      workspaceName,
		},
	}

	// TODO: update the UpdatedAt and UpdatedBy annotations in the patch as well
	//       investigate how to do this cleanly, since we are using a JSON patch
	//       and its not clear that modelsCommon.UpdateObjectMetaForUpdate can be used here

	if err := r.client.Patch(ctx, workspace, client.RawPatch(types.JSONPatchType, patchBytes)); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceNotFound
		}
		if apierrors.IsInvalid(err) {
			return nil, ErrWorkspaceInvalidState
		}
		return nil, fmt.Errorf("failed to patch workspace: %w", err)
	}

	workspaceActionPauseModel := modelsActions.NewWorkspaceActionPauseFromWorkspace(workspace)
	return workspaceActionPauseModel, nil
}
