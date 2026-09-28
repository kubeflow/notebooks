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

	corev1 "k8s.io/api/core/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
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

// WorkspaceKindRestrictedError indicates that a Workspace create/update was rejected
// because the referenced WorkspaceKind itself is hidden or denied by a WORKSPACE_KIND-scoped
// filterRule for the target namespace (as opposed to a specific imageConfig/podConfig
// option being restricted - see enforceImageConfigFilterRule / enforcePodConfigFilterRule
// for those cases).
//
// Hidden and DenyMessage are independent signals:
//   - Hidden reports that the WorkspaceKind is hidden (APIHide) for this namespace.
//   - DenyMessage carries the operator-supplied text on a Deny effect.
//
// If both Hide and Deny apply, Hide wins - the constructor only emits Hidden in that
// case to avoid leaking the DenyMessage for a workspace kind the caller is not allowed
// to know exists. DenyMessage is therefore only ever non-empty when Hidden is false.
type WorkspaceKindRestrictedError struct {
	Kind        string
	Mutation    wsMutationType
	Hidden      bool
	DenyMessage string
}

func (e *WorkspaceKindRestrictedError) Error() string {
	suffix := "is restricted"
	if e.Hidden {
		suffix = "is hidden"
	}
	msg := fmt.Sprintf("workspace %s not allowed: workspace kind %q %s", e.Mutation, e.Kind, suffix)
	if !e.Hidden && e.DenyMessage != "" {
		msg = fmt.Sprintf("%s: %s", msg, e.DenyMessage)
	}
	return msg
}

type WorkspaceRepository struct {
	cfg    *config.EnvConfig
	client client.Client
}

type wsMutationType string

const (
	wsMutationTypeCreate wsMutationType = "create"
	wsMutationTypeUpdate wsMutationType = "update"
)

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

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, actor user.Info, workspaceCreate *models.WorkspaceCreate, namespace string) (*models.WorkspaceCreate, error) {
	// get the WorkspaceKind referenced by this Workspace - required to evaluate its
	// filterRules below. Any failure here (including the WorkspaceKind not existing)
	// is a hard failure (root 500): we cannot evaluate filterRules without it, and a
	// create request should always reference a real WorkspaceKind.
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceCreate.Kind}, workspaceKind); err != nil {
		return nil, err
	}

	// reject the request (403) if the WorkspaceKind itself is denied by
	// a WORKSPACE_KIND-scoped filterRule for this namespace.
	namespaceLabels, err := r.resolveNamespaceLabels(ctx, namespace)
	if err != nil {
		return nil, err
	}

	if err := r.enforceWorkspaceKindFilterRules(workspaceKind, namespaceLabels, wsMutationTypeCreate); err != nil {
		return nil, err
	}

	// reject the request (422) if the selected imageConfig/podConfig is
	// denied or hidden by a filterRule for this namespace. Both options are
	// evaluated on create since both are being selected for the first time.
	evalCtx := filterrules.BuildEvalContextForImageAndPodCfg(workspaceKind, namespaceLabels, workspaceCreate.PodTemplate.Options.ImageConfig, workspaceCreate.PodTemplate.Options.PodConfig)

	var filterErrs field.ErrorList
	filterErrs = append(filterErrs, r.enforceImageConfigFilterRule(workspaceKind, evalCtx, workspaceCreate.PodTemplate.Options.ImageConfig)...)
	filterErrs = append(filterErrs, r.enforcePodConfigFilterRule(workspaceKind, evalCtx, workspaceCreate.PodTemplate.Options.PodConfig)...)
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

	// get the WorkspaceKind referenced by this Workspace - required to evaluate its
	// filterRules below. Any failure here (including the WorkspaceKind not existing)
	// is a hard failure (root 500): we cannot evaluate filterRules without it.
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspace.Spec.Kind}, workspaceKind); err != nil {
		return nil, err
	}

	// reject the request (403) if the WorkspaceKind itself is denied by
	// a WORKSPACE_KIND-scoped filterRule for this namespace. Evaluated on every update,
	// not just when imageConfig/podConfig changes, since the WorkspaceKind is fixed for
	// the lifetime of the Workspace and isn't part of what's "changing" here.
	namespaceLabels, err := r.resolveNamespaceLabels(ctx, namespace)
	if err != nil {
		return nil, err
	}

	if err := r.enforceWorkspaceKindFilterRules(workspaceKind, namespaceLabels, wsMutationTypeUpdate); err != nil {
		return nil, err
	}

	// only re-evaluate filterRules for an option that is actually changing - an
	// unrelated update should not be blocked by a rule that started denying an option
	// the workspace already has.
	newOptions := workspaceUpdate.PodTemplate.Options
	currentOptions := workspace.Spec.PodTemplate.Options

	evalCtx := filterrules.BuildEvalContextForImageAndPodCfg(workspaceKind, namespaceLabels, newOptions.ImageConfig, newOptions.PodConfig)

	var filterErrs field.ErrorList
	if newOptions.ImageConfig != currentOptions.ImageConfig {
		filterErrs = append(filterErrs, r.enforceImageConfigFilterRule(workspaceKind, evalCtx, newOptions.ImageConfig)...)
	}
	if newOptions.PodConfig != currentOptions.PodConfig {
		filterErrs = append(filterErrs, r.enforcePodConfigFilterRule(workspaceKind, evalCtx, newOptions.PodConfig)...)
	}
	if len(filterErrs) > 0 {
		return nil, helper.NewInternalValidationError(filterErrs)
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

// resolveNamespaceLabels fetches the labels of the given namespace, used to evaluate
// `matchNamespace` conditions in filterRules.
func (r *WorkspaceRepository) resolveNamespaceLabels(ctx context.Context, namespaceName string) (map[string]string, error) {
	ns := &corev1.Namespace{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: namespaceName}, ns); err != nil {
		return nil, err
	}
	return ns.Labels, nil
}

// enforceWorkspaceKindFilterRules evaluates the WorkspaceKind's WORKSPACE_KIND-scoped
// filterRules against the given namespace labels and returns a WorkspaceKindRestrictedError
// if the WorkspaceKind is hidden or denied for this namespace.
//
// If both Hide and Deny apply, Hide wins: a hidden WorkspaceKind should never leak the
// admin-authored deny message to the client.
func (r *WorkspaceRepository) enforceWorkspaceKindFilterRules(
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	namespaceLabels map[string]string,
	mutation wsMutationType,
) error {
	result := filterrules.EvaluateWorkspaceKindFilterScopeRule(workspaceKind, namespaceLabels)

	if result.APIHide {
		return &WorkspaceKindRestrictedError{
			Kind:     workspaceKind.Name,
			Mutation: mutation,
			Hidden:   true,
		}
	}

	if result.Restrictions.Deny {
		var denyMsg string
		if result.Restrictions.DenyMessage != nil {
			denyMsg = result.Restrictions.DenyMessage.Text
		}
		return &WorkspaceKindRestrictedError{
			Kind:        workspaceKind.Name,
			Mutation:    mutation,
			DenyMessage: denyMsg,
		}
	}

	return nil
}

// enforceImageConfigFilterRule evaluates the WorkspaceKind's IMAGE_CONFIG-scoped filterRules
// against the selected imageConfig value and returns any field errors describing restrictions
// (hidden and/or denied) that apply. Both Hide and Deny can accumulate on the same field path.
//
// Returns nil (silent no-op) if imageConfigID does not match any value in the WorkspaceKind -
// existence validation is handled downstream by NewWorkspaceFromWorkspaceCreateModel.
func (r *WorkspaceRepository) enforceImageConfigFilterRule(
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	evalCtx filterrules.EvalContext,
	imageConfigID string,
) field.ErrorList {
	value := findImageConfigValue(workspaceKind, imageConfigID)
	if value == nil {
		return nil
	}

	result := filterrules.Evaluate(filterrules.EvalTarget{
		Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
		Labels: value.Spawner.Labels,
	}, evalCtx)

	var errs field.ErrorList
	imgPath := field.NewPath("spec", "podTemplate", "options", "imageConfig")

	if result.APIHide {
		errs = append(errs, field.Forbidden(imgPath, fmt.Sprintf("not allowed: image config option %q is hidden", imageConfigID)))
	}

	if result.Restrictions.Deny {
		msg := fmt.Sprintf("not allowed: image config option %q is restricted", imageConfigID)
		if result.Restrictions.DenyMessage != nil && result.Restrictions.DenyMessage.Text != "" {
			msg = fmt.Sprintf("%s: %s", msg, result.Restrictions.DenyMessage.Text)
		}
		errs = append(errs, field.Forbidden(imgPath, msg))
	}

	return errs
}

// enforcePodConfigFilterRule evaluates the WorkspaceKind's POD_CONFIG-scoped filterRules
// against the selected podConfig value and returns any field errors describing restrictions
// (hidden and/or denied) that apply. Both Hide and Deny can accumulate on the same field path.
//
// Returns nil (silent no-op) if podConfigID does not match any value in the WorkspaceKind -
// existence validation is handled downstream by NewWorkspaceFromWorkspaceCreateModel.
func (r *WorkspaceRepository) enforcePodConfigFilterRule(
	workspaceKind *kubefloworgv1beta1.WorkspaceKind,
	evalCtx filterrules.EvalContext,
	podConfigID string,
) field.ErrorList {
	value := findPodConfigValue(workspaceKind, podConfigID)
	if value == nil {
		return nil
	}

	result := filterrules.Evaluate(filterrules.EvalTarget{
		Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
		Labels: value.Spawner.Labels,
	}, evalCtx)

	var errs field.ErrorList
	podPath := field.NewPath("spec", "podTemplate", "options", "podConfig")

	if result.APIHide {
		errs = append(errs, field.Forbidden(podPath, fmt.Sprintf("not allowed: pod config option %q is hidden", podConfigID)))
	}

	if result.Restrictions.Deny {
		msg := fmt.Sprintf("not allowed: pod config option %q is restricted", podConfigID)
		if result.Restrictions.DenyMessage != nil && result.Restrictions.DenyMessage.Text != "" {
			msg = fmt.Sprintf("%s: %s", msg, result.Restrictions.DenyMessage.Text)
		}
		errs = append(errs, field.Forbidden(podPath, msg))
	}

	return errs
}

// findImageConfigValue returns the imageConfig value with the given id, or nil if not found.
func findImageConfigValue(wsk *kubefloworgv1beta1.WorkspaceKind, id string) *kubefloworgv1beta1.ImageConfigValue {
	values := wsk.Spec.PodTemplate.Options.ImageConfig.Values
	for i := range values {
		if values[i].Id == id {
			return &values[i]
		}
	}
	return nil
}

// findPodConfigValue returns the podConfig value with the given id, or nil if not found.
func findPodConfigValue(wsk *kubefloworgv1beta1.WorkspaceKind, id string) *kubefloworgv1beta1.PodConfigValue {
	values := wsk.Spec.PodTemplate.Options.PodConfig.Values
	for i := range values {
		if values[i].Id == id {
			return &values[i]
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
