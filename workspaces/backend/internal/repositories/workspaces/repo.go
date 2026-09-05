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
	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	// convert workspace to WorkspaceUpdate model
	workspaceUpdateModel := models.NewWorkspaceUpdateModelFromWorkspace(workspace)

	return workspaceUpdateModel, nil
}

func (r *WorkspaceRepository) GetWorkspaceDetails(ctx context.Context, namespace string, workspaceName string) (*modelsDetails.WorkspaceDetails, error) {
	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	// get workspace kind, if it exists
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspace.Spec.Kind}, workspaceKind); err != nil {
		if !apierrors.IsNotFound(err) {
			return nil, err
		}
	}

	// convert workspace to WorkspaceDetails model
	details := modelsDetails.NewWorkspaceDetailsFromWorkspace(workspace, workspaceKind)
	return &details, nil
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.WorkspaceListItem, error) {
	return r.getWorkspaceModels(ctx, client.InNamespace(namespace))
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.WorkspaceListItem, error) {
	return r.getWorkspaceModels(ctx)
}

// getWorkspaceModels lists workspaces using the provided ListOptions and converts them to models.
func (r *WorkspaceRepository) getWorkspaceModels(ctx context.Context, listOptions ...client.ListOption) ([]models.WorkspaceListItem, error) {
	// get workspaces using the provided list options
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList, listOptions...); err != nil {
		return nil, err
	}

	// convert workspaces to WorkspaceListItem models
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

		workspacesModels[i] = models.NewWorkspaceListItemFromWorkspace(r.cfg, &workspace, workspaceKind)
	}

	return workspacesModels, nil
}

// enforceFilterRuleRestrictions looks up the named WorkspaceKind and evaluates its
// spec.filterRules[] for the selected imageConfig and/or podConfig. It returns a
// field.ErrorList (empty when nothing is denied) describing any option a rule denies,
// using that rule's denyMessage.text.
//
// checkImageConfig / checkPodConfig let the caller skip an option that isn't part of
// this request (e.g. on update, an option the caller isn't actually changing).
func (r *WorkspaceRepository) enforceFilterRuleRestrictions(
	ctx context.Context,
	namespace string,
	kind string,
	options models.PodTemplateOptionsMutate,
	checkImageConfig, checkPodConfig bool,
) (field.ErrorList, error) {
	var errs field.ErrorList

	// look up the WorkspaceKind so we have its filterRules + option definitions
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: kind}, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			// unknown kind is a different problem - let the normal create/update
			// flow surface it, this check isn't responsible for that
			return nil, nil
		}
		return nil, err
	}

	// resolve the target namespace's labels, used by `matchNamespace` conditions
	namespaceLabels, err := r.resolveNamespaceLabels(ctx, namespace)
	if err != nil {
		return nil, err
	}

	evalCtx := filterrules.BuildEvalContext(workspaceKind, namespaceLabels, options.ImageConfig, options.PodConfig)

	if checkImageConfig {
		if value := findImageConfigValue(workspaceKind, options.ImageConfig); value != nil {
			result := filterrules.Evaluate(filterrules.EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: value.Spawner.Labels,
			}, evalCtx)
			if result.Restrictions.Deny {
				path := field.NewPath("podTemplate", "options", "imageConfig")
				errs = append(errs, field.Forbidden(path, denyDetail(result.Restrictions, options.ImageConfig)))
			}
		}
	}

	if checkPodConfig {
		if value := findPodConfigValue(workspaceKind, options.PodConfig); value != nil {
			result := filterrules.Evaluate(filterrules.EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
				Labels: value.Spawner.Labels,
			}, evalCtx)
			if result.Restrictions.Deny {
				path := field.NewPath("podTemplate", "options", "podConfig")
				errs = append(errs, field.Forbidden(path, denyDetail(result.Restrictions, options.PodConfig)))
			}
		}
	}

	return errs, nil
}

// resolveNamespaceLabels fetches the labels of the given namespace.
// Returns nil (no error) if the namespace doesn't exist, so `matchNamespace`
// conditions are conservatively treated as non-matching rather than failing the request.
func (r *WorkspaceRepository) resolveNamespaceLabels(ctx context.Context, namespace string) (map[string]string, error) {
	ns := &corev1.Namespace{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: namespace}, ns); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	labels := make(map[string]string, len(ns.Labels))
	maps.Copy(labels, ns.Labels)
	return labels, nil
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

// denyDetail returns the matched rule's denyMessage.text, falling back to a generic
// message since denyMessage is optional on the CRD.
func denyDetail(restrictions modelsCommon.Restrictions, optionID string) string {
	if restrictions.DenyMessage != nil && restrictions.DenyMessage.Text != "" {
		return restrictions.DenyMessage.Text
	}
	return fmt.Sprintf("option %q is restricted by a filter rule", optionID)
}

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, actor user.Info, workspaceCreate *models.WorkspaceCreate, namespace string) (*models.WorkspaceCreate, error) {
	// enforce filter rule restrictions for imageConfig and podConfig
	filterErrs, err := r.enforceFilterRuleRestrictions(ctx, namespace, workspaceCreate.Kind, workspaceCreate.PodTemplate.Options, true, true)
	if err != nil {
		return nil, err
	}
	if len(filterErrs) > 0 {
		return nil, helper.NewInternalValidationError(filterErrs)
	}

	// create workspace object from model
	workspace, err := models.NewWorkspaceFromWorkspaceCreateModel(ctx, r.client, workspaceCreate, namespace)
	if err != nil {
		return nil, err
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

func (r *WorkspaceRepository) UpdateWorkspace(ctx context.Context, actor user.Info, workspaceUpdate *models.WorkspaceUpdate, namespace, workspaceName string) (*models.WorkspaceUpdate, error) {
	now := time.Now()

	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	// ensure caller's revision matches current workspace revision
	// prevents updates by callers with a stale view of the workspace
	clusterRevision := modelsCommon.CalculateRevision(&workspace.ObjectMeta)
	callerRevision := workspaceUpdate.Revision
	if clusterRevision != callerRevision {
		return nil, ErrWorkspaceRevisionConflict
	}

	// Before applying the update, validate that the new imageConfig or podConfig
	// doesn't violate any WorkspaceKind filterRules for the workspace's kind.
	newOptions := workspaceUpdate.PodTemplate.Options
	currentOptions := workspace.Spec.PodTemplate.Options
	imageConfigChanged := newOptions.ImageConfig != currentOptions.ImageConfig
	podConfigChanged := newOptions.PodConfig != currentOptions.PodConfig
	if imageConfigChanged || podConfigChanged {
		filterErrs, err := r.enforceFilterRuleRestrictions(ctx, namespace, workspace.Spec.Kind, newOptions, imageConfigChanged, podConfigChanged)
		if err != nil {
			return nil, err
		}
		if len(filterErrs) > 0 {
			return nil, helper.NewInternalValidationError(filterErrs)
		}
	}

	// apply update model to workspace object
	if err := models.ApplyWorkspaceUpdateModelToWorkspace(ctx, r.client, workspaceUpdate, workspace); err != nil {
		return nil, err
	}

	// set audit annotations
	modelsCommon.UpdateObjectMetaForUpdate(&workspace.ObjectMeta, actor, now)

	// TODO: if the update fails due to a kubernetes conflict, this implies our cache is stale.
	//       we should wrap this operation in retry.RetryOnConflict to retry the entire update
	//       (including re-fetching and recalculating clusterRevision) before returning a 500
	//       error to the caller (DO NOT return a 409, as it's not the caller's fault)
	if err := r.client.Update(ctx, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
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
			return repoCommon.ErrWorkspaceNotFound
		}
		return err
	}

	return nil
}

// WorkspacePatchOperation represents a single JSONPatch operation
type WorkspacePatchOperation struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	Value any    `json:"value,omitempty"`
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
