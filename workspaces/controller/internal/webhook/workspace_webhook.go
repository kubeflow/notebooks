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
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

// WorkspaceValidator validates a Workspace object
type WorkspaceValidator struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:webhook:path=/validate-kubeflow-org-v1beta1-workspace,mutating=false,failurePolicy=fail,sideEffects=None,groups=kubeflow.org,resources=workspaces,verbs=create;update,versions=v1beta1,name=vworkspace.kb.io,admissionReviewVersions=v1

// SetupWebhookWithManager sets up the webhook with the manager
func (v *WorkspaceValidator) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).
		For(&kubefloworgv1beta1.Workspace{}).
		WithValidator(v).
		Complete()
}

// ValidateCreate validates the Workspace on creation.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceValidator) ValidateCreate(ctx context.Context, obj runtime.Object) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating Workspace create")

	workspace, ok := obj.(*kubefloworgv1beta1.Workspace)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a Workspace object but got %T", obj))
	}

	var allErrs field.ErrorList

	// fetch the WorkspaceKind
	workspaceKind, err := v.validateWorkspaceKind(ctx, workspace)
	if err != nil {
		allErrs = append(allErrs, err)

		// if the WorkspaceKind is not found, we cannot validate the Workspace further
		return nil, apierrors.NewInvalid(
			schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "Workspace"},
			workspace.Name,
			allErrs,
		)
	}

	// validate the Workspace
	if err := v.validateImageConfig(workspace, workspaceKind); err != nil {
		allErrs = append(allErrs, err)
	}
	if err := v.validatePodConfig(workspace, workspaceKind); err != nil {
		allErrs = append(allErrs, err)
	}
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
func (v *WorkspaceValidator) ValidateUpdate(ctx context.Context, oldObj, newObj runtime.Object) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating Workspace update")

	newWorkspace, ok := newObj.(*kubefloworgv1beta1.Workspace)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a Workspace object but got %T", newObj))
	}
	oldWorkspace, ok := oldObj.(*kubefloworgv1beta1.Workspace)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected old object to be a Workspace but got %T", oldObj))
	}

	var allErrs field.ErrorList

	// check if workspace kind related fields have changed
	var workspaceKindChange = false
	var imageConfigChange = false
	var podConfigChange = false
	if newWorkspace.Spec.Kind != oldWorkspace.Spec.Kind {
		workspaceKindChange = true
	}
	if newWorkspace.Spec.PodTemplate.Options.ImageConfig != oldWorkspace.Spec.PodTemplate.Options.ImageConfig {
		imageConfigChange = true
	}
	if newWorkspace.Spec.PodTemplate.Options.PodConfig != oldWorkspace.Spec.PodTemplate.Options.PodConfig {
		podConfigChange = true
	}

	// if any of the workspace kind related fields have changed, revalidate the workspace
	if workspaceKindChange || imageConfigChange || podConfigChange {
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

		// validate the new imageConfig
		if imageConfigChange {
			if err := v.validateImageConfig(newWorkspace, workspaceKind); err != nil {
				allErrs = append(allErrs, err)
			}
		}

		// validate the new podConfig
		if podConfigChange {
			if err := v.validatePodConfig(newWorkspace, workspaceKind); err != nil {
				allErrs = append(allErrs, err)
			}
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
func (v *WorkspaceValidator) ValidateDelete(ctx context.Context, obj runtime.Object) (admission.Warnings, error) {
	// no validation needed for deletion
	// NOTE: add "delete" to the webhook configuration (+kubebuilder:webhook) if you want to enable deletion validation
	return nil, nil
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

// validateImageConfig checks if the imageConfig selected by a Workspace exists a WorkspaceKind
func (v *WorkspaceValidator) validateImageConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) *field.Error {
	imageConfig := workspace.Spec.PodTemplate.Options.ImageConfig
	for _, value := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		if imageConfig == value.Id {
			// imageConfig found
			return nil
		}
	}
	imageConfigPath := field.NewPath("spec", "podTemplate", "options", "imageConfig")
	return field.Invalid(
		imageConfigPath,
		imageConfig,
		fmt.Sprintf("imageConfig with id %q not found in workspace kind %q", imageConfig, workspaceKind.Name),
	)
}

// validatePodConfig checks if the podConfig selected by a Workspace exists a WorkspaceKind
func (v *WorkspaceValidator) validatePodConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) *field.Error {
	podConfig := workspace.Spec.PodTemplate.Options.PodConfig
	for _, value := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		if podConfig == value.Id {
			// podConfig found
			return nil
		}
	}
	podConfigPath := field.NewPath("spec", "podTemplate", "options", "podConfig")
	return field.Invalid(
		podConfigPath,
		podConfig,
		fmt.Sprintf("podConfig with id %q not found in workspace kind %q", podConfig, workspaceKind.Name),
	)
}
