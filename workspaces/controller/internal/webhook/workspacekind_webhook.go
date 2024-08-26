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
	"errors"
	"fmt"
	"reflect"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/controller"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// WorkspaceKindValidator validates a Workspace object
type WorkspaceKindValidator struct {
	client.Client
	Scheme *runtime.Scheme
}

//+kubebuilder:webhook:path=/validate-kubeflow-org-v1beta1-workspacekind,mutating=false,failurePolicy=fail,sideEffects=None,groups=kubeflow.org,resources=workspacekinds,verbs=create;update;delete,versions=v1beta1,name=vworkspacekind.kb.io,admissionReviewVersions=v1

// SetupWebhookWithManager sets up the webhook with the manager
func (v *WorkspaceKindValidator) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).
		For(&kubefloworgv1beta1.WorkspaceKind{}).
		WithValidator(v).
		Complete()
}

// ValidateCreate validates the WorkspaceKind on creation.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceKindValidator) ValidateCreate(ctx context.Context, obj runtime.Object) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating WorkspaceKind create")

	var allErrs field.ErrorList

	workspaceKind, ok := obj.(*kubefloworgv1beta1.WorkspaceKind)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a WorkspaceKind object but got %T", obj))
	}

	// validate the extra environment variables
	allErrs = append(allErrs, validateExtraEnv(workspaceKind)...)

	// generate helper maps for imageConfig values
	imageConfigIdMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	imageConfigRedirectMap := make(map[string]string)
	for _, imageConfigValue := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigIdMap[imageConfigValue.Id] = imageConfigValue
		if imageConfigValue.Redirect != nil {
			imageConfigRedirectMap[imageConfigValue.Id] = imageConfigValue.Redirect.To
		}
	}

	// generate helper maps for podConfig values
	podConfigIdMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	podConfigRedirectMap := make(map[string]string)
	for _, podConfigValue := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigIdMap[podConfigValue.Id] = podConfigValue
		if podConfigValue.Redirect != nil {
			podConfigRedirectMap[podConfigValue.Id] = podConfigValue.Redirect.To
		}
	}

	// validate default options
	allErrs = append(allErrs, validateDefaultImageConfig(workspaceKind, imageConfigIdMap)...)
	allErrs = append(allErrs, validateDefaultPodConfig(workspaceKind, podConfigIdMap)...)

	// validate imageConfig values
	for _, imageConfigValue := range imageConfigIdMap {
		imageConfigValueId := imageConfigValue.Id
		imageConfigValuePath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "values").Key(imageConfigValueId)
		allErrs = append(allErrs, validateImageConfigValue(&imageConfigValue, imageConfigValuePath)...)
	}

	// validate redirects
	allErrs = append(allErrs, validateImageConfigRedirects(imageConfigIdMap, imageConfigRedirectMap)...)
	allErrs = append(allErrs, validatePodConfigRedirects(podConfigIdMap, podConfigRedirectMap)...)

	if len(allErrs) == 0 {
		return nil, nil
	}

	return nil, apierrors.NewInvalid(
		schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "WorkspaceKind"},
		workspaceKind.Name,
		allErrs,
	)
}

// ValidateUpdate validates the WorkspaceKind on update.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceKindValidator) ValidateUpdate(ctx context.Context, oldObj, newObj runtime.Object) (admission.Warnings, error) { // nolint:gocyclo
	log := log.FromContext(ctx)
	log.V(1).Info("validating WorkspaceKind update")

	var allErrs field.ErrorList

	newWorkspaceKind, ok := newObj.(*kubefloworgv1beta1.WorkspaceKind)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a WorkspaceKind object but got %T", newObj))
	}
	oldWorkspaceKind, ok := oldObj.(*kubefloworgv1beta1.WorkspaceKind)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected old object to be a WorkspaceKind but got %T", oldObj))
	}

	// get usage count for imageConfig and podConfig values
	imageConfigUsageCount, podConfigUsageCount, err := v.getOptionsUsageCounts(ctx, oldWorkspaceKind)
	if err != nil {
		return nil, err
	}

	// validate the extra environment variables
	if !reflect.DeepEqual(newWorkspaceKind.Spec.PodTemplate.ExtraEnv, oldWorkspaceKind.Spec.PodTemplate.ExtraEnv) {
		allErrs = append(allErrs, validateExtraEnv(newWorkspaceKind)...)
	}

	// calculate changes to imageConfig values
	var shouldValidateImageConfigRedirects = false
	toValidateImageConfigIds := make(map[string]bool)
	badChangedImageConfigIds := make(map[string]bool)
	badRemovedImageConfigIds := make(map[string]bool)
	oldImageConfigIdMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	newImageConfigIdMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	newImageConfigRedirectMap := make(map[string]string)
	for _, imageConfigValue := range oldWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		oldImageConfigIdMap[imageConfigValue.Id] = imageConfigValue
	}
	for _, imageConfigValue := range newWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		newImageConfigIdMap[imageConfigValue.Id] = imageConfigValue
		if imageConfigValue.Redirect != nil {
			newImageConfigRedirectMap[imageConfigValue.Id] = imageConfigValue.Redirect.To
		}

		// check if the imageConfig value is new
		if _, exists := oldImageConfigIdMap[imageConfigValue.Id]; !exists {
			// we need to validate this imageConfig value since it is new
			toValidateImageConfigIds[imageConfigValue.Id] = true

			// we always need to validate the imageConfig redirects if an imageConfig value was added
			shouldValidateImageConfigRedirects = true
		} else {
			// check if this imageConfig value is used by any workspaces
			var usageCount int32
			if usageCount, exists = imageConfigUsageCount[imageConfigValue.Id]; !exists {
				return nil, apierrors.NewInternalError(fmt.Errorf("usage count not found for imageConfig value %q", imageConfigValue.Id))
			}

			// check if the spec has changed
			if !reflect.DeepEqual(oldImageConfigIdMap[imageConfigValue.Id].Spec, imageConfigValue.Spec) {
				// we need to validate this imageConfig value since it has changed
				toValidateImageConfigIds[imageConfigValue.Id] = true

				// if this imageConfig is used by any workspaces, mark this imageConfig as bad,
				// (the spec is immutable while in use)
				if usageCount > 0 {
					badChangedImageConfigIds[imageConfigValue.Id] = true
				}
			}

			// if we haven't already decided to validate the imageConfig redirects,
			// check if the redirect has changed
			if !shouldValidateImageConfigRedirects && !reflect.DeepEqual(oldImageConfigIdMap[imageConfigValue.Id].Redirect, imageConfigValue.Redirect) {
				shouldValidateImageConfigRedirects = true
			}
		}
	}
	for id := range oldImageConfigIdMap {

		// check if this imageConfig value was removed
		if _, exists := newImageConfigIdMap[id]; !exists {
			// check if this imageConfig value is used by any workspaces
			var usageCount int32
			if usageCount, exists = imageConfigUsageCount[id]; !exists {
				return nil, apierrors.NewInternalError(fmt.Errorf("usage count not found for imageConfig value %q", id))
			}

			// if this imageConfig is used by any workspaces, mark this imageConfig as bad,
			// it is not safe to remove an imageConfig value that is in use
			if usageCount > 0 {
				badRemovedImageConfigIds[id] = true
			}

			// we always need to validate the imageConfig redirects if an imageConfig was removed
			shouldValidateImageConfigRedirects = true
		}
	}

	// calculate changes to podConfig values
	var shouldValidatePodConfigRedirects = false
	badChangedPodConfigIds := make(map[string]bool)
	badRemovedPodConfigIds := make(map[string]bool)
	newPodConfigIdMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	newPodConfigRedirectMap := make(map[string]string)
	oldPodConfigIdMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	for _, podConfigValue := range oldWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		oldPodConfigIdMap[podConfigValue.Id] = podConfigValue
	}
	for _, podConfigValue := range newWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		newPodConfigIdMap[podConfigValue.Id] = podConfigValue
		if podConfigValue.Redirect != nil {
			newPodConfigRedirectMap[podConfigValue.Id] = podConfigValue.Redirect.To
		}

		// check if the podConfig value is new
		if _, exists := oldPodConfigIdMap[podConfigValue.Id]; !exists {
			// we always need to validate the podConfig redirects if a podConfig was added
			shouldValidatePodConfigRedirects = true
		} else {
			// check if this podConfig value is used by any workspaces
			var usageCount int32
			if usageCount, exists = podConfigUsageCount[podConfigValue.Id]; !exists {
				return nil, apierrors.NewInternalError(fmt.Errorf("usage count not found for podConfig value %q", podConfigValue.Id))
			}

			// normalize the podConfig specs
			oldPodConfigSpec := oldPodConfigIdMap[podConfigValue.Id].Spec
			err := normalizePodConfigSpec(oldPodConfigSpec)
			if err != nil {
				return nil, apierrors.NewInternalError(fmt.Errorf("failed to normalize podConfig spec: %w", err))
			}
			newPodConfigSpec := podConfigValue.Spec
			err = normalizePodConfigSpec(newPodConfigSpec)
			if err != nil {
				return nil, apierrors.NewInternalError(fmt.Errorf("failed to normalize podConfig spec: %w", err))
			}

			// if this podConfig is used by any workspaces, check if the spec has changed
			// if the spec has changed, mark this podConfig as bad (the spec is immutable while in use)
			if usageCount > 0 && !reflect.DeepEqual(oldPodConfigSpec, newPodConfigSpec) {
				badChangedPodConfigIds[podConfigValue.Id] = true
			}

			// if we haven't already decided to validate the podConfig redirects,
			// check if the redirect has changed
			if !shouldValidatePodConfigRedirects && !reflect.DeepEqual(oldPodConfigIdMap[podConfigValue.Id].Redirect, podConfigValue.Redirect) {
				shouldValidatePodConfigRedirects = true
			}
		}
	}
	for id := range oldPodConfigIdMap {

		// check if this podConfig value was removed
		if _, exists := newPodConfigIdMap[id]; !exists {
			// check if this podConfig value is used by any workspaces
			var usageCount int32
			if usageCount, exists = podConfigUsageCount[id]; !exists {
				return nil, apierrors.NewInternalError(fmt.Errorf("usage count not found for podConfig value %q", id))
			}

			// if this podConfig is used by any workspaces, mark this podConfig as bad,
			// it is not safe to remove a podConfig value that is in use
			if usageCount > 0 {
				badRemovedPodConfigIds[id] = true
			}

			// we always need to validate the podConfig redirects if a podConfig was removed
			shouldValidatePodConfigRedirects = true
		}
	}

	// validate default options
	if oldWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Spawner.Default != newWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Spawner.Default {
		allErrs = append(allErrs, validateDefaultImageConfig(newWorkspaceKind, newImageConfigIdMap)...)
	}
	if oldWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Spawner.Default != newWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Spawner.Default {
		allErrs = append(allErrs, validateDefaultPodConfig(newWorkspaceKind, newPodConfigIdMap)...)
	}

	// validate imageConfig values
	// NOTE: we only need to validate new or changed imageConfig values
	for imageConfigValueId := range toValidateImageConfigIds {
		imageConfigValue := newImageConfigIdMap[imageConfigValueId]
		imageConfigValuePath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "values").Key(imageConfigValueId)
		allErrs = append(allErrs, validateImageConfigValue(&imageConfigValue, imageConfigValuePath)...)
	}

	// validate bad imageConfig values
	for id := range badChangedImageConfigIds {
		imageConfigValuePath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "values").Key(id)
		allErrs = append(allErrs, field.Invalid(imageConfigValuePath, id, fmt.Sprintf("imageConfig value %q is in use and cannot be changed", id)))
	}
	for id := range badRemovedImageConfigIds {
		imageConfigValuePath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "values").Key(id)
		allErrs = append(allErrs, field.Invalid(imageConfigValuePath, id, fmt.Sprintf("imageConfig value %q is in use and cannot be removed", id)))
	}

	// validate bad podConfig values
	for id := range badChangedPodConfigIds {
		podConfigValuePath := field.NewPath("spec", "podTemplate", "options", "podConfig", "values").Key(id)
		allErrs = append(allErrs, field.Invalid(podConfigValuePath, id, fmt.Sprintf("podConfig value %q is in use and cannot be changed", id)))
	}
	for id := range badRemovedPodConfigIds {
		podConfigValuePath := field.NewPath("spec", "podTemplate", "options", "podConfig", "values").Key(id)
		allErrs = append(allErrs, field.Invalid(podConfigValuePath, id, fmt.Sprintf("podConfig value %q is in use and cannot be removed", id)))
	}

	// validate redirects
	if shouldValidateImageConfigRedirects {
		allErrs = append(allErrs, validateImageConfigRedirects(newImageConfigIdMap, newImageConfigRedirectMap)...)
	}
	if shouldValidatePodConfigRedirects {
		allErrs = append(allErrs, validatePodConfigRedirects(newPodConfigIdMap, newPodConfigRedirectMap)...)
	}

	if len(allErrs) == 0 {
		return nil, nil
	}

	return nil, apierrors.NewInvalid(
		schema.GroupKind{Group: kubefloworgv1beta1.GroupVersion.Group, Kind: "WorkspaceKind"},
		newWorkspaceKind.Name,
		allErrs,
	)
}

// ValidateDelete validates the WorkspaceKind on deletion.
// The optional warnings will be added to the response as warning messages.
// Return an error if the object is invalid.
func (v *WorkspaceKindValidator) ValidateDelete(ctx context.Context, obj runtime.Object) (admission.Warnings, error) {
	log := log.FromContext(ctx)
	log.V(1).Info("validating WorkspaceKind delete")

	workspaceKind, ok := obj.(*kubefloworgv1beta1.WorkspaceKind)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected a WorkspaceKind object but got %T", obj))
	}

	// don't allow deletion of WorkspaceKind if it is used by any workspaces
	if workspaceKind.Status.Workspaces > 0 {
		return nil, apierrors.NewConflict(
			schema.GroupResource{Group: kubefloworgv1beta1.GroupVersion.Group, Resource: "WorkspaceKind"},
			workspaceKind.Name,
			fmt.Errorf("WorkspaceKind is used by %d workspace(s)", workspaceKind.Status.Workspaces),
		)
	}

	// don't allow deletion of WorkspaceKind if it has the protection finalizer
	// NOTE: while the finalizer also protects the WorkspaceKind from deletion,
	//       it is impossible to "un-delete" a resource once it has started terminating
	//       and this is a bad user experience, so we prevent deletion in the first place
	if controllerutil.ContainsFinalizer(workspaceKind, controller.WorkspaceKindFinalizer) {
		return nil, apierrors.NewConflict(
			schema.GroupResource{Group: kubefloworgv1beta1.GroupVersion.Group, Resource: "WorkspaceKind"},
			workspaceKind.Name,
			errors.New("WorkspaceKind has protection finalizer, indicating one or more workspaces are still using it"),
		)
	}

	return nil, nil
}

// getOptionsUsageCounts returns the usage counts for each imageConfig and podConfig value
func (v *WorkspaceKindValidator) getOptionsUsageCounts(ctx context.Context, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (map[string]int32, map[string]int32, *apierrors.StatusError) {
	podConfigUsageCount := make(map[string]int32)
	imageConfigUsageCount := make(map[string]int32)

	// if possible, we get the counts from the status of the WorkspaceKind. these counts are updated by the
	// controller so could be stale if the controller is not running or a workspace was very recently added or removed.
	// however, since the controller gracefully handles cases of a Workspace referencing a non-existent imageConfig
	// or podConfig value, we can safely use these counts to validate the WorkspaceKind, Workspaces will simply be
	// put into an error state and the user can correct the issue. these counts will NOT be set in the WorkspaceKind
	// unit tests, so we implement a fallback method to count the Workspaces that are using each option.
	if len(workspaceKind.Status.PodTemplateOptions.ImageConfig) > 0 && len(workspaceKind.Status.PodTemplateOptions.PodConfig) > 0 {
		for _, imageConfigMetrics := range workspaceKind.Status.PodTemplateOptions.ImageConfig {
			imageConfigUsageCount[imageConfigMetrics.Id] = imageConfigMetrics.Workspaces
		}
		for _, podConfigMetrics := range workspaceKind.Status.PodTemplateOptions.PodConfig {
			podConfigUsageCount[podConfigMetrics.Id] = podConfigMetrics.Workspaces
		}
	}

	// fetch all Workspaces that are using this WorkspaceKind
	workspaces := &kubefloworgv1beta1.WorkspaceList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceKindField, workspaceKind.Name),
		Namespace:     "", // fetch Workspaces in all namespaces
	}
	if err := v.List(ctx, workspaces, listOpts); err != nil {
		return nil, nil, apierrors.NewInternalError(err)
	}

	// count the number of Workspaces using each option
	for _, imageConfig := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigUsageCount[imageConfig.Id] = 0
	}
	for _, podConfig := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigUsageCount[podConfig.Id] = 0
	}
	for _, ws := range workspaces.Items {
		imageConfigUsageCount[ws.Spec.PodTemplate.Options.ImageConfig]++
		podConfigUsageCount[ws.Spec.PodTemplate.Options.PodConfig]++
	}

	return imageConfigUsageCount, podConfigUsageCount, nil
}

// validateExtraEnv validates the extra environment variables in a WorkspaceKind
func validateExtraEnv(workspaceKind *kubefloworgv1beta1.WorkspaceKind) []*field.Error {
	var errs []*field.Error

	// the real httpPathPrefix can't fail, so we return a dummy value
	httpPathPrefixFunc := func(portId string) string {
		return "DUMMY_HTTP_PATH_PREFIX"
	}

	// validate that each value template can be rendered successfully
	for _, env := range workspaceKind.Spec.PodTemplate.ExtraEnv {
		if env.Value != "" {
			rawValue := env.Value
			_, err := helper.RenderExtraEnvValueTemplate(rawValue, httpPathPrefixFunc)
			if err != nil {
				extraEnvPath := field.NewPath("spec", "podTemplate", "extraEnv").Key(env.Name).Child("value")
				errs = append(errs, field.Invalid(extraEnvPath, rawValue, err.Error()))
			}
		}
	}

	return errs
}

// validateDefaultImageConfig validates the default imageConfig in a WorkspaceKind
func validateDefaultImageConfig(workspaceKind *kubefloworgv1beta1.WorkspaceKind, imageConfigValueMap map[string]kubefloworgv1beta1.ImageConfigValue) []*field.Error {
	var errs []*field.Error

	// validate the default imageConfig
	defaultImageConfig := workspaceKind.Spec.PodTemplate.Options.ImageConfig.Spawner.Default
	if _, exists := imageConfigValueMap[defaultImageConfig]; !exists {
		defaultImageConfigPath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "spawner", "default")
		errs = append(errs, field.Invalid(defaultImageConfigPath, defaultImageConfig, fmt.Sprintf("default imageConfig %q not found", defaultImageConfig)))
	}

	return errs
}

// validateDefaultPodConfig validates the default podConfig in a WorkspaceKind
func validateDefaultPodConfig(workspaceKind *kubefloworgv1beta1.WorkspaceKind, podConfigValueMap map[string]kubefloworgv1beta1.PodConfigValue) []*field.Error {
	var errs []*field.Error

	// validate the default podConfig
	defaultPodConfig := workspaceKind.Spec.PodTemplate.Options.PodConfig.Spawner.Default
	if _, exists := podConfigValueMap[defaultPodConfig]; !exists {
		defaultPodConfigPath := field.NewPath("spec", "podTemplate", "options", "podConfig", "spawner", "default")
		errs = append(errs, field.Invalid(defaultPodConfigPath, defaultPodConfig, fmt.Sprintf("default podConfig %q not found", defaultPodConfig)))
	}

	return errs
}

// validateImageConfigValue validates an imageConfig value
func validateImageConfigValue(imageConfigValue *kubefloworgv1beta1.ImageConfigValue, imageConfigValuePath *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the ports
	seenPorts := make(map[int32]bool)
	for _, port := range imageConfigValue.Spec.Ports {
		portId := port.Id
		portNumber := port.Port
		if _, exists := seenPorts[portNumber]; exists {
			portPath := imageConfigValuePath.Child("spec", "ports").Key(portId).Child("port")
			errs = append(errs, field.Invalid(portPath, portNumber, fmt.Sprintf("port %d is defined more than once", portNumber)))
		}
		seenPorts[portNumber] = true
	}

	return errs
}

// validateImageConfigRedirects validates redirects in the imageConfig values
func validateImageConfigRedirects(imageConfigIdMap map[string]kubefloworgv1beta1.ImageConfigValue, imageConfigRedirectMap map[string]string) []*field.Error {
	var errs []*field.Error

	// validate imageConfig redirects
	checkedNodes := make(map[string]bool)
	for id, redirectTo := range imageConfigRedirectMap {
		// check if there is a cycle involving the current node
		if cycle := helper.DetectGraphCycle(id, checkedNodes, imageConfigRedirectMap); cycle != nil {
			redirectToPath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "values").Key(id).Child("redirect", "to")
			errs = append(errs, field.Invalid(redirectToPath, redirectTo, fmt.Sprintf("cycle detected: %v", cycle)))
			break // stop checking redirects if a cycle is detected
		}

		// ensure the target of the redirect exists
		if _, exists := imageConfigIdMap[redirectTo]; !exists {
			redirectToPath := field.NewPath("spec", "podTemplate", "options", "imageConfig", "values").Key(id).Child("redirect", "to")
			errs = append(errs, field.Invalid(redirectToPath, redirectTo, fmt.Sprintf("invalid redirect target %q", redirectTo)))
		}
	}

	return errs
}

// validatePodConfigRedirects validates redirects in the podConfig values
func validatePodConfigRedirects(podConfigIdMap map[string]kubefloworgv1beta1.PodConfigValue, podConfigRedirectMap map[string]string) []*field.Error {
	var errs []*field.Error

	// validate podConfig redirects
	checkedNodes := make(map[string]bool)
	for id, redirectTo := range podConfigRedirectMap {
		// check if there is a cycle involving the current node
		if cycle := helper.DetectGraphCycle(id, checkedNodes, podConfigRedirectMap); cycle != nil {
			redirectToPath := field.NewPath("spec", "podTemplate", "options", "podConfig", "values").Key(id).Child("redirect", "to")
			errs = append(errs, field.Invalid(redirectToPath, redirectTo, fmt.Sprintf("cycle detected: %v", cycle)))
			break // stop checking redirects if a cycle is detected
		}

		// ensure the target of the redirect exists
		if _, exists := podConfigIdMap[redirectTo]; !exists {
			redirectToPath := field.NewPath("spec", "podTemplate", "options", "podConfig", "values").Key(id).Child("redirect", "to")
			errs = append(errs, field.Invalid(redirectToPath, redirectTo, fmt.Sprintf("invalid redirect target %q", redirectTo)))
		}
	}

	return errs
}

// normalizePodConfigSpec normalizes a PodConfigSpec so that it can be compared with reflect.DeepEqual
func normalizePodConfigSpec(spec kubefloworgv1beta1.PodConfigSpec) (err error) {
	// Normalize Affinity
	if spec.Affinity != nil && reflect.DeepEqual(spec.Affinity, corev1.Affinity{}) {
		spec.Affinity = nil
	}

	// Normalize NodeSelector
	if spec.NodeSelector != nil && len(spec.NodeSelector) == 0 {
		spec.NodeSelector = nil
	}

	// Normalize Tolerations
	if spec.Tolerations != nil && len(spec.Tolerations) == 0 {
		spec.Tolerations = nil
	}

	// Normalize Resources.Requests
	if reflect.DeepEqual(spec.Resources.Requests, corev1.ResourceList{}) {
		spec.Resources.Requests = nil
	}
	if spec.Resources.Requests != nil {
		for key, value := range spec.Resources.Requests {
			q, err := resource.ParseQuantity(value.String())
			if err != nil {
				return err
			}
			spec.Resources.Requests[key] = q
		}
	}

	// Normalize Resources.Limits
	if reflect.DeepEqual(spec.Resources.Limits, corev1.ResourceList{}) {
		spec.Resources.Limits = nil
	}
	if spec.Resources.Limits != nil {
		for key, value := range spec.Resources.Limits {
			q, err := resource.ParseQuantity(value.String())
			if err != nil {
				return err
			}
			spec.Resources.Limits[key] = q
		}
	}

	return nil
}
