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

package webhook

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apivalidation "k8s.io/apimachinery/pkg/api/validation"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1validation "k8s.io/apimachinery/pkg/apis/meta/v1/validation"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

// orphanDeleteMessage explains why orphan deletion of a Workspace is not permitted.
const orphanDeleteMessage = "orphan deletion is not permitted for Workspaces, " +
	"because it would leave the resources owned by the Workspace (StatefulSet, Service, VirtualService) " +
	"running in the cluster with no parent, use cascading deletion instead"

// WorkspaceValidator validates a Workspace object
type WorkspaceValidator struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:webhook:path=/validate-kubeflow-org-v1beta1-workspace,mutating=false,failurePolicy=fail,sideEffects=None,groups=kubeflow.org,resources=workspaces,verbs=create;update;delete,versions=v1beta1,name=vworkspace.kb.io,admissionReviewVersions=v1,serviceName=workspaces-webhook-service

// SetupWebhookWithManager sets up the webhook with the manager
func (v *WorkspaceValidator) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr, &kubefloworgv1beta1.Workspace{}).
		WithValidator(v).
		Complete()
}

// ValidateCreate validates the Workspace on creation.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceValidator) ValidateCreate(ctx context.Context, workspace *kubefloworgv1beta1.Workspace) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating Workspace create")

	var allErrs field.ErrorList

	// fetch the WorkspaceKind
	workspaceKind, err := v.validateWorkspaceKind(ctx, workspace)
	if err != nil {
		allErrs = append(allErrs, err)

		// if the WorkspaceKind is not found, we cannot validate the Workspace further
		return nil, apierrors.NewInvalid(
			schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "Workspace"}, //nolint:goconst
			workspace.Name,
			allErrs,
		)
	}

	// validate the Workspace
	// NOTE: we do this after fetching the WorkspaceKind as there will be multiple types in the future,
	//       and we need to know which one the Workspace is using to validate it correctly.
	allErrs = append(allErrs, v.validateNoOrphanFinalizer(workspace)...)
	allErrs = append(allErrs, v.validatePodTemplatePodMetadata(workspace)...)
	allErrs = append(allErrs, v.validateImageConfig(workspace, workspaceKind)...)
	allErrs = append(allErrs, v.validatePodConfig(workspace, workspaceKind)...)

	if len(allErrs) == 0 {
		return nil, nil
	}

	return nil, apierrors.NewInvalid(
		schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "Workspace"},
		workspace.Name,
		allErrs,
	)
}

// ValidateUpdate validates the Workspace on update.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceValidator) ValidateUpdate(ctx context.Context, oldWorkspace, newWorkspace *kubefloworgv1beta1.Workspace) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating Workspace update")

	var allErrs field.ErrorList

	// don't allow the "orphan" finalizer to be added to an existing Workspace
	// NOTE: we only reject updates that ADD the finalizer, so a Workspace which somehow already has it
	//       can still be updated (e.g. to remove the finalizer)
	if !controllerutil.ContainsFinalizer(oldWorkspace, metav1.FinalizerOrphanDependents) {
		allErrs = append(allErrs, v.validateNoOrphanFinalizer(newWorkspace)...)
	}

	// check if workspace kind related fields have changed
	var workspaceKindChange = false
	var podMetadataChange = false
	var imageConfigChange = false
	var podConfigChange = false
	if newWorkspace.Spec.Kind != oldWorkspace.Spec.Kind {
		workspaceKindChange = true
	}
	if !equality.Semantic.DeepEqual(newWorkspace.Spec.PodTemplate.PodMetadata, oldWorkspace.Spec.PodTemplate.PodMetadata) {
		podMetadataChange = true
	}
	if newWorkspace.Spec.PodTemplate.Options.ImageConfig != oldWorkspace.Spec.PodTemplate.Options.ImageConfig {
		imageConfigChange = true
	}
	if newWorkspace.Spec.PodTemplate.Options.PodConfig != oldWorkspace.Spec.PodTemplate.Options.PodConfig {
		podConfigChange = true
	}

	// if any of the workspace kind related fields have changed, revalidate the workspace
	if workspaceKindChange || podMetadataChange || imageConfigChange || podConfigChange {
		// fetch the WorkspaceKind
		workspaceKind, err := v.validateWorkspaceKind(ctx, newWorkspace)
		if err != nil {
			allErrs = append(allErrs, err)

			// if the WorkspaceKind is not found, we cannot validate the Workspace further
			return nil, apierrors.NewInvalid(
				schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "Workspace"},
				newWorkspace.Name,
				allErrs,
			)
		}

		// validate the new podTemplate podMetadata
		if podMetadataChange {
			allErrs = append(allErrs, v.validatePodTemplatePodMetadata(newWorkspace)...)
		}

		// validate the new imageConfig
		if imageConfigChange {
			allErrs = append(allErrs, v.validateImageConfig(newWorkspace, workspaceKind)...)
		}

		// validate the new podConfig
		if podConfigChange {
			allErrs = append(allErrs, v.validatePodConfig(newWorkspace, workspaceKind)...)
		}
	}

	if len(allErrs) == 0 {
		return nil, nil
	}

	return nil, apierrors.NewInvalid(
		schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "Workspace"},
		newWorkspace.Name,
		allErrs,
	)
}

// ValidateDelete validates the Workspace on deletion.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceValidator) ValidateDelete(ctx context.Context, workspace *kubefloworgv1beta1.Workspace) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating Workspace delete")

	var allErrs field.ErrorList //nolint:prealloc

	// don't allow the Workspace to be deleted with `propagationPolicy=Orphan`
	fieldErrs, err := v.validateNoOrphanPropagationPolicy(ctx)
	if err != nil {
		return nil, err
	}
	allErrs = append(allErrs, fieldErrs...)

	if len(allErrs) == 0 {
		return nil, nil
	}

	return nil, apierrors.NewInvalid(
		schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "Workspace"},
		workspace.Name,
		allErrs,
	)
}

// validateNoOrphanFinalizer validates that a Workspace does not have the "orphan" finalizer,
// which would cause its owned resources to be left running in the cluster once it is deleted.
func (v *WorkspaceValidator) validateNoOrphanFinalizer(workspace *kubefloworgv1beta1.Workspace) []*field.Error {
	var errs []*field.Error

	finalizersPath := field.NewPath("metadata", "finalizers")

	if controllerutil.ContainsFinalizer(workspace, metav1.FinalizerOrphanDependents) {
		errs = append(errs, field.Invalid(
			finalizersPath,
			metav1.FinalizerOrphanDependents,
			orphanDeleteMessage,
		))
	}

	return errs
}

// validateNoOrphanPropagationPolicy validates that the in-flight delete request did not request orphan
// deletion, either with `propagationPolicy=Orphan` or the deprecated `orphanDependents=true` option.
func (v *WorkspaceValidator) validateNoOrphanPropagationPolicy(ctx context.Context) ([]*field.Error, error) {
	var errs []*field.Error

	propagationPolicyPath := field.NewPath("propagationPolicy")
	orphanDependentsPath := field.NewPath("orphanDependents")

	req, err := admission.RequestFromContext(ctx)
	if err != nil {
		// the admission request is always present for real delete requests, so treat its absence as an error
		return nil, fmt.Errorf("unable to read admission request to determine deletion propagation policy: %w", err)
	}

	// if there are no delete options, the default (non-orphan) propagation policy is used
	if len(req.Options.Raw) == 0 {
		return nil, nil
	}

	deleteOptions := &metav1.DeleteOptions{}
	if err := json.Unmarshal(req.Options.Raw, deleteOptions); err != nil {
		return nil, fmt.Errorf("unable to decode delete options: %w", err)
	}

	if deleteOptions.PropagationPolicy != nil && *deleteOptions.PropagationPolicy == metav1.DeletePropagationOrphan {
		errs = append(errs, field.Invalid(
			propagationPolicyPath,
			*deleteOptions.PropagationPolicy,
			orphanDeleteMessage,
		))
	}

	// `orphanDependents` is deprecated, but the API server still honors it
	if deleteOptions.OrphanDependents != nil && *deleteOptions.OrphanDependents { //nolint:staticcheck
		errs = append(errs, field.Invalid(
			orphanDependentsPath,
			*deleteOptions.OrphanDependents, //nolint:staticcheck
			orphanDeleteMessage,
		))
	}

	return errs, nil
}

// validateWorkspaceKind fetches the WorkspaceKind for a Workspace and returns an error if it does not exist
func (v *WorkspaceValidator) validateWorkspaceKind(ctx context.Context, workspace *kubefloworgv1beta1.Workspace) (*kubefloworgv1beta1.WorkspaceKind, *field.Error) {
	workspaceKindName := workspace.Spec.Kind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := v.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		workspaceKindNamePath := field.NewPath("spec", "kind")
		if apierrors.IsNotFound(err) {
			return nil, field.Invalid(
				workspaceKindNamePath,
				workspaceKindName,
				fmt.Sprintf("workspace kind %q not found", workspaceKindName),
			)
		} else {
			return nil, field.InternalError(
				workspaceKindNamePath,
				err,
			)
		}
	}
	return workspaceKind, nil
}

// validatePodTemplatePodMetadata validates the podMetadata of a Workspace's PodTemplate
func (v *WorkspaceValidator) validatePodTemplatePodMetadata(workspace *kubefloworgv1beta1.Workspace) []*field.Error {
	var errs []*field.Error //nolint:prealloc

	podMetadata := workspace.Spec.PodTemplate.PodMetadata
	podMetadataPath := field.NewPath("spec", "podTemplate", "podMetadata")

	// if podMetadata is nil, we cannot validate it
	if podMetadata == nil {
		return nil
	}

	// validate labels
	labels := podMetadata.Labels
	labelsPath := podMetadataPath.Child("labels")
	errs = append(errs, v1validation.ValidateLabels(labels, labelsPath)...)

	// validate annotations
	annotations := podMetadata.Annotations
	annotationsPath := podMetadataPath.Child("annotations")
	errs = append(errs, apivalidation.ValidateAnnotations(annotations, annotationsPath)...)

	return errs
}

// validateImageConfig validates the imageConfig selected by a Workspace
func (v *WorkspaceValidator) validateImageConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) []*field.Error {
	var errs []*field.Error

	imageConfig := workspace.Spec.PodTemplate.Options.ImageConfig
	imageConfigPath := field.NewPath("spec", "podTemplate", "options", "imageConfig")

	// ensure the imageConfig exists in the WorkspaceKind
	foundImageConfig := false
	for _, value := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		if imageConfig == value.Id {
			foundImageConfig = true
			break
		}
	}
	if !foundImageConfig {
		errs = append(errs, field.Invalid(
			imageConfigPath,
			imageConfig,
			fmt.Sprintf("imageConfig with id %q not found in workspace kind %q", imageConfig, workspaceKind.Name),
		))
	}

	return errs
}

// validatePodConfig validates the podConfig selected by a Workspace
func (v *WorkspaceValidator) validatePodConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) []*field.Error {
	var errs []*field.Error

	podConfig := workspace.Spec.PodTemplate.Options.PodConfig
	podConfigPath := field.NewPath("spec", "podTemplate", "options", "podConfig")

	// ensure the podConfig exists in the WorkspaceKind
	foundPodConfig := false
	for _, value := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		if podConfig == value.Id {
			foundPodConfig = true
			break
		}
	}
	if !foundPodConfig {
		errs = append(errs, field.Invalid(
			podConfigPath,
			podConfig,
			fmt.Sprintf("podConfig with id %q not found in workspace kind %q", podConfig, workspaceKind.Name),
		))
	}

	return errs
}
