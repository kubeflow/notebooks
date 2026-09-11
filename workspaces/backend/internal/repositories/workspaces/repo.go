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
	"maps"
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/authentication/user"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/filterrules"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	modelsActions "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/actions"
	modelsDetails "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/details"
	repoCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/common"
)

var (
	ErrWorkspaceAlreadyExists    = fmt.Errorf("workspace already exists")
	ErrWorkspaceInvalidState     = fmt.Errorf("workspace is in an invalid state for this operation")
	ErrWorkspaceRevisionConflict = fmt.Errorf("current workspace revision does not match request")
)

type WorkspaceKindRestrictedError struct {
	Message string
}

func (e *WorkspaceKindRestrictedError) Error() string {
	return e.Message
}

type WorkspaceRepository struct {
	cfg    *config.EnvConfig
	client client.Client
}

func NewWorkspaceRepository(cfg *config.EnvConfig, cl client.Client) *WorkspaceRepository {
	return &WorkspaceRepository{
		cfg:    cfg,
		client: cl,
	}
}

func (r *WorkspaceRepository) GetWorkspace(ctx context.Context, namespace string, workspaceName string) (*models.WorkspaceUpdate, error) {
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	workspaceUpdateModel := models.NewWorkspaceUpdateModelFromWorkspace(workspace)
	return workspaceUpdateModel, nil
}

func (r *WorkspaceRepository) GetWorkspaceDetails(ctx context.Context, namespace string, workspaceName string) (*modelsDetails.WorkspaceDetails, error) {
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspace.Spec.Kind}, workspaceKind); err != nil {
		if !apierrors.IsNotFound(err) {
			return nil, err
		}
	}

	details := modelsDetails.NewWorkspaceDetailsFromWorkspace(workspace, workspaceKind)
	return &details, nil
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.WorkspaceListItem, error) {
	return r.getWorkspaceModels(ctx, client.InNamespace(namespace))
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.WorkspaceListItem, error) {
	return r.getWorkspaceModels(ctx)
}

func (r *WorkspaceRepository) getWorkspaceModels(ctx context.Context, listOptions ...client.ListOption) ([]models.WorkspaceListItem, error) {
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList, listOptions...); err != nil {
		return nil, err
	}

	workspacesModels := make([]models.WorkspaceListItem, len(workspaceList.Items))
	for i, workspace := range workspaceList.Items {
		workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
		workspaceKindName := workspace.Spec.Kind
		if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
			if !apierrors.IsNotFound(err) {
				return nil, err
			}
		}

		workspacesModels[i] = models.NewWorkspaceListItemFromWorkspace(r.cfg, &workspace, workspaceKind)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, actor user.Info, workspaceCreate *models.WorkspaceCreate, namespace string) (*models.WorkspaceCreate, error) {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceCreate.Kind}, workspaceKind); err != nil {
		return nil, err
	}

	if err := r.enforceWorkspaceKindFilterRules(ctx, namespace, workspaceKind, "create"); err != nil {
		return nil, err
	}

	filterErrs, err := r.enforceOptionFilterRules(ctx, namespace, workspaceKind, workspaceCreate.PodTemplate.Options, true, true)
	if err != nil {
		return nil, err
	}
	if len(filterErrs) > 0 {
		return nil, helper.NewInternalValidationError(filterErrs)
	}

	workspace, err := models.NewWorkspaceFromWorkspaceCreateModel(ctx, r.client, workspaceCreate, namespace)
	if err != nil {
		return nil, err
	}

	if workspace.Annotations == nil {
		workspace.Annotations = make(map[string]string)
	}
	workspace.Annotations[modelsCommon.AnnotationCreatedBy] = actor.GetName()
	workspace.Annotations[modelsCommon.AnnotationUpdatedBy] = actor.GetName()

	if err := r.client.Create(ctx, workspace); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, ErrWorkspaceAlreadyExists
		}
		return nil, err
	}

	return workspaceCreate, nil
}

func (r *WorkspaceRepository) UpdateWorkspace(ctx context.Context, actor user.Info, workspaceUpdate *models.WorkspaceUpdate, namespace, workspaceName string) (*models.WorkspaceUpdate, error) {
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	currentRevision := modelsCommon.CalculateRevision(&workspace.ObjectMeta)
	if workspaceUpdate.Revision != currentRevision {
		return nil, ErrWorkspaceRevisionConflict
	}

	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspace.Spec.Kind}, workspaceKind); err != nil {
		return nil, err
	}

	if err := r.enforceWorkspaceKindFilterRules(ctx, namespace, workspaceKind, "update"); err != nil {
		return nil, err
	}

	newOptions := workspaceUpdate.PodTemplate.Options
	currentOptions := workspace.Spec.PodTemplate.Options
	imageConfigChanged := newOptions.ImageConfig != currentOptions.ImageConfig
	podConfigChanged := newOptions.PodConfig != currentOptions.PodConfig

	if imageConfigChanged || podConfigChanged {
		filterErrs, err := r.enforceOptionFilterRules(ctx, namespace, workspaceKind, newOptions, imageConfigChanged, podConfigChanged)
		if err != nil {
			return nil, err
		}
		if len(filterErrs) > 0 {
			return nil, helper.NewInternalValidationError(filterErrs)
		}
	}

	var volumeErrs field.ErrorList
	for i, v := range workspaceUpdate.PodTemplate.Volumes.Data {
		pvcPath := field.NewPath("podTemplate", "volumes", "data").Index(i).Child("pvcName")
		errs, err := helper.ValidateKubernetesPVCIsMountable(ctx, r.client, pvcPath, namespace, v.PVCName)
		if err != nil {
			return nil, err
		}
		volumeErrs = append(volumeErrs, errs...)
	}

	for i, s := range workspaceUpdate.PodTemplate.Volumes.Secrets {
		secretPath := field.NewPath("podTemplate", "volumes", "secrets").Index(i).Child("secretName")
		errs, err := helper.ValidateKubernetesSecretIsMountable(ctx, r.client, secretPath, namespace, s.SecretName)
		if err != nil {
			return nil, err
		}
		volumeErrs = append(volumeErrs, errs...)
	}

	if len(volumeErrs) > 0 {
		return nil, helper.NewInternalValidationError(volumeErrs)
	}

	if workspaceUpdate.DisplayName == "" {
		workspace.Spec.DisplayName = nil
	} else {
		workspace.Spec.DisplayName = &workspaceUpdate.DisplayName
	}
	workspace.Spec.Paused = workspaceUpdate.Paused
	workspace.Spec.PodTemplate.PodMetadata.Labels = workspaceUpdate.PodTemplate.PodMetadata.Labels
	workspace.Spec.PodTemplate.PodMetadata.Annotations = workspaceUpdate.PodTemplate.PodMetadata.Annotations
	workspace.Spec.PodTemplate.Options.ImageConfig = workspaceUpdate.PodTemplate.Options.ImageConfig
	workspace.Spec.PodTemplate.Options.PodConfig = workspaceUpdate.PodTemplate.Options.PodConfig

	workspace.Spec.PodTemplate.Volumes.Home = workspaceUpdate.PodTemplate.Volumes.Home

	var dataVolumes []kubefloworgv1beta1.PodVolumeMount
	for _, v := range workspaceUpdate.PodTemplate.Volumes.Data {
		readOnlyVal := v.ReadOnly
		dataVolumes = append(dataVolumes, kubefloworgv1beta1.PodVolumeMount{
			PVCName:   v.PVCName,
			MountPath: v.MountPath,
			ReadOnly:  &readOnlyVal,
		})
	}
	workspace.Spec.PodTemplate.Volumes.Data = dataVolumes

	var secretVolumes []kubefloworgv1beta1.PodSecretMount
	for _, s := range workspaceUpdate.PodTemplate.Volumes.Secrets {
		secretVolumes = append(secretVolumes, kubefloworgv1beta1.PodSecretMount{
			SecretName:  s.SecretName,
			MountPath:   s.MountPath,
			DefaultMode: s.DefaultMode,
		})
	}
	workspace.Spec.PodTemplate.Volumes.Secrets = secretVolumes

	modelsCommon.UpdateObjectMetaForUpdate(&workspace.ObjectMeta, actor, time.Now())

	if err := r.client.Update(ctx, workspace); err != nil {
		if apierrors.IsConflict(err) {
			return nil, ErrWorkspaceRevisionConflict
		}
		return nil, err
	}

	return models.NewWorkspaceUpdateModelFromWorkspace(workspace), nil
}

func (r *WorkspaceRepository) resolveNamespaceLabels(ctx context.Context, namespace string) (map[string]string, error) {
	ns := &corev1.Namespace{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: namespace}, ns); err != nil {
		return nil, err
	}

	labels := make(map[string]string, len(ns.Labels))
	maps.Copy(labels, ns.Labels)
	return labels, nil
}

func (r *WorkspaceRepository) enforceWorkspaceKindFilterRules(
	ctx context.Context,
	namespace string,
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	action string,
) error {
	namespaceLabels, err := r.resolveNamespaceLabels(ctx, namespace)
	if err != nil {
		return err
	}

	result := filterrules.EvaluateWorkspaceKindFilterScopeRule(workspaceKind, namespaceLabels)

	if result.APIHide {
		return &WorkspaceKindRestrictedError{
			Message: fmt.Sprintf("workspace %s not allowed: workspace kind is hidden", action),
		}
	}
	if result.Restrictions.Deny {
		msg := fmt.Sprintf("workspace %s not allowed: workspace kind is restricted", action)
		if result.Restrictions.DenyMessage != nil && result.Restrictions.DenyMessage.Text != "" {
			msg = fmt.Sprintf("%s: %s", msg, result.Restrictions.DenyMessage.Text)
		}
		return &WorkspaceKindRestrictedError{
			Message: msg,
		}
	}

	return nil
}

func (r *WorkspaceRepository) enforceOptionFilterRules(
	ctx context.Context,
	namespace string,
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	options models.PodTemplateOptionsMutate,
	checkImageConfig, checkPodConfig bool,
) (field.ErrorList, error) {
	var errs field.ErrorList

	namespaceLabels, err := r.resolveNamespaceLabels(ctx, namespace)
	if err != nil {
		return nil, err
	}

	evalCtx := filterrules.BuildEvalContextForImageAndPodCfg(workspaceKind, namespaceLabels, options.ImageConfig, options.PodConfig)

	if checkPodConfig {
		if value := findPodConfigValue(workspaceKind, options.PodConfig); value != nil {
			result := filterrules.Evaluate(filterrules.EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
				Labels: value.Spawner.Labels,
			}, evalCtx)

			podPath := field.NewPath("spec", "podTemplate", "options", "podConfig")
			if result.APIHide {
				errs = append(errs, field.Forbidden(podPath, "not allowed: pod config option is hidden"))
			}
			if result.Restrictions.Deny {
				msg := "not allowed: pod config option is restricted"
				if result.Restrictions.DenyMessage != nil && result.Restrictions.DenyMessage.Text != "" {
					msg = fmt.Sprintf("%s: %s", msg, result.Restrictions.DenyMessage.Text)
				}
				errs = append(errs, field.Forbidden(podPath, msg))
			}
		}
	}

	if checkImageConfig {
		if value := findImageConfigValue(workspaceKind, options.ImageConfig); value != nil {
			result := filterrules.Evaluate(filterrules.EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: value.Spawner.Labels,
			}, evalCtx)

			imgPath := field.NewPath("spec", "podTemplate", "options", "imageConfig")
			if result.APIHide {
				errs = append(errs, field.Forbidden(imgPath, "not allowed: image config option is hidden"))
			}
			if result.Restrictions.Deny {
				msg := "not allowed: image config option is restricted"
				if result.Restrictions.DenyMessage != nil && result.Restrictions.DenyMessage.Text != "" {
					msg = fmt.Sprintf("%s: %s", msg, result.Restrictions.DenyMessage.Text)
				}
				errs = append(errs, field.Forbidden(imgPath, msg))
			}
		}
	}

	return errs, nil
}

func findImageConfigValue(wsk *kubefloworgv1beta1.WorkspaceKind, id string) *kubefloworgv1beta1.ImageConfigValue {
	for i := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
		if wsk.Spec.PodTemplate.Options.ImageConfig.Values[i].Id == id {
			return &wsk.Spec.PodTemplate.Options.ImageConfig.Values[i]
		}
	}
	return nil
}

func findPodConfigValue(wsk *kubefloworgv1beta1.WorkspaceKind, id string) *kubefloworgv1beta1.PodConfigValue {
	for i := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
		if wsk.Spec.PodTemplate.Options.PodConfig.Values[i].Id == id {
			return &wsk.Spec.PodTemplate.Options.PodConfig.Values[i]
		}
	}
	return nil
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
			return repoCommon.ErrWorkspaceNotFound
		}
		return err
	}

	return nil
}

type WorkspacePatchOperation struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	Value any    `json:"value,omitempty"`
}

func (r *WorkspaceRepository) HandlePauseAction(ctx context.Context, namespace, workspaceName string, workspaceActionPause *modelsActions.WorkspaceActionPause) (*modelsActions.WorkspaceActionPause, error) {
	targetPauseState := workspaceActionPause.Paused

	patch := []WorkspacePatchOperation{
		{
			Op:    "test",
			Path:  "/spec/paused",
			Value: !targetPauseState,
		},
	}

	if !targetPauseState {
		patch = append(patch, WorkspacePatchOperation{
			Op:    "test",
			Path:  "/status/state",
			Value: kubefloworgv1beta1.WorkspaceStatePaused,
		})
	}

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

	if err := r.client.Patch(ctx, workspace, client.RawPatch(types.JSONPatchType, patchBytes)); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		if apierrors.IsInvalid(err) {
			return nil, ErrWorkspaceInvalidState
		}
		return nil, fmt.Errorf("failed to patch workspace: %w", err)
	}

	workspaceActionPauseModel := modelsActions.NewWorkspaceActionPauseFromWorkspace(workspace)
	return workspaceActionPauseModel, nil
}
