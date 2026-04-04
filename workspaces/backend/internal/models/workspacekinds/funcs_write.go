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

package workspacekinds

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"reflect"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// copyStringMap creates a copy of a string map, returning nil if the input is nil.
func copyStringMap(src map[string]string) map[string]string {
	if src == nil {
		return nil
	}
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

// CalculateWorkspaceKindRevision calculates the revision/etag for a workspace kind.
// FORMAT: hex(sha256("<WSK_UUID>:<WSK_NAME>:<WSK_GENERATION>"))
// this detects changes to the `spec` of the workspace kind, while also ensuring
// that the resource itself is the same (via UID and name).
func CalculateWorkspaceKindRevision(wsk *kubefloworgv1beta1.WorkspaceKind) string {
	revisionInput := fmt.Sprintf("%s:%s:%d", wsk.UID, wsk.Name, wsk.Generation)
	hash := sha256.Sum256([]byte(revisionInput))
	return hex.EncodeToString(hash[:])
}

// NewWorkspaceKindUpdateModelFromWorkspaceKind creates a WorkspaceKindUpdate model from a WorkspaceKind object.
// Used by GET single and Create responses.
func NewWorkspaceKindUpdateModelFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind) *WorkspaceKindUpdate {
	return &WorkspaceKindUpdate{
		Revision:    CalculateWorkspaceKindRevision(wsk),
		Spawner:     buildSpawnerMutate(&wsk.Spec.Spawner),
		PodTemplate: buildPodTemplateMutate(&wsk.Spec.PodTemplate),
	}
}

// buildSpawnerMutate constructs a WorkspaceKindSpawnerMutate from the CRD spawner.
func buildSpawnerMutate(src *kubefloworgv1beta1.WorkspaceKindSpawner) WorkspaceKindSpawnerMutate {
	return WorkspaceKindSpawnerMutate{
		DisplayName:        src.DisplayName,
		Description:        src.Description,
		Hidden:             src.Hidden,
		Deprecated:         src.Deprecated,
		DeprecationMessage: src.DeprecationMessage,
		Icon: WorkspaceKindIconMutate{
			Url:       src.Icon.Url,
			ConfigMap: src.Icon.ConfigMap,
		},
		Logo: WorkspaceKindIconMutate{
			Url:       src.Logo.Url,
			ConfigMap: src.Logo.ConfigMap,
		},
	}
}

// buildPodTemplateMutate constructs a WorkspaceKindPodTemplateMutate from the CRD pod template.
// Excludes immutable fields: serviceAccount, volumeMounts.
func buildPodTemplateMutate(src *kubefloworgv1beta1.WorkspaceKindPodTemplate) WorkspaceKindPodTemplateMutate {
	var podMetadata *WorkspaceKindPodMetadataMutate
	if src.PodMetadata != nil {
		podMetadata = &WorkspaceKindPodMetadataMutate{
			Labels:      copyStringMap(src.PodMetadata.Labels),
			Annotations: copyStringMap(src.PodMetadata.Annotations),
		}
	}

	return WorkspaceKindPodTemplateMutate{
		PodMetadata:              podMetadata,
		Culling:                  src.Culling,
		Probes:                   src.Probes,
		Ports:                    src.Ports,
		ExtraEnv:                 src.ExtraEnv,
		ExtraVolumeMounts:        src.ExtraVolumeMounts,
		ExtraVolumes:             src.ExtraVolumes,
		SecurityContext:          src.SecurityContext,
		ContainerSecurityContext: src.ContainerSecurityContext,
		Options:                  buildOptionsMutate(&src.Options),
	}
}

// buildOptionsMutate constructs a WorkspaceKindOptionsMutate from the CRD options.
func buildOptionsMutate(src *kubefloworgv1beta1.WorkspaceKindPodOptions) WorkspaceKindOptionsMutate {
	return WorkspaceKindOptionsMutate{
		ImageConfig: buildImageConfigMutate(&src.ImageConfig),
		PodConfig:   buildPodConfigMutate(&src.PodConfig),
	}
}

// buildImageConfigMutate constructs an ImageConfigMutate from the CRD image config.
func buildImageConfigMutate(src *kubefloworgv1beta1.ImageConfig) ImageConfigMutate {
	values := make([]ImageConfigValueMutate, len(src.Values))
	for i, v := range src.Values {
		values[i] = ImageConfigValueMutate{
			Id:       v.Id,
			Hidden:   v.Spawner.Hidden,
			Redirect: v.Redirect,
			Spawner:  &v.Spawner,
			Spec:     &v.Spec,
		}
	}
	return ImageConfigMutate{
		Spawner: OptionSpawnerConfigMutate{Default: src.Spawner.Default},
		Values:  values,
	}
}

// buildPodConfigMutate constructs a PodConfigMutate from the CRD pod config.
func buildPodConfigMutate(src *kubefloworgv1beta1.PodConfig) PodConfigMutate {
	values := make([]PodConfigValueMutate, len(src.Values))
	for i, v := range src.Values {
		values[i] = PodConfigValueMutate{
			Id:       v.Id,
			Hidden:   v.Spawner.Hidden,
			Redirect: v.Redirect,
			Spawner:  &v.Spawner,
			Spec:     &v.Spec,
		}
	}
	return PodConfigMutate{
		Spawner: OptionSpawnerConfigMutate{Default: src.Spawner.Default},
		Values:  values,
	}
}

// ValidateAndApplyWorkspaceKindUpdate validates the update against the current state and applies mutable changes.
// Returns validation errors if the user attempts to change immutable fields on existing options
// or omits required fields on new options.
// NOTE: this function mutates wsk in-place. If errors are returned,
// the caller MUST NOT use the mutated object (e.g., do not call client.Update).
func ValidateAndApplyWorkspaceKindUpdate(update *WorkspaceKindUpdate, wsk *kubefloworgv1beta1.WorkspaceKind) field.ErrorList {
	var allErrs field.ErrorList

	// apply spawner fields
	applySpawnerMutate(&update.Spawner, &wsk.Spec.Spawner)

	// apply mutable pod template fields (skip immutable: serviceAccount, volumeMounts)
	applyPodTemplateMutate(&update.PodTemplate, &wsk.Spec.PodTemplate)

	// validate and apply options
	optionsPath := field.NewPath("data", "podTemplate", "options")
	allErrs = append(allErrs, validateAndApplyImageConfig(&update.PodTemplate.Options.ImageConfig, &wsk.Spec.PodTemplate.Options.ImageConfig, optionsPath.Child("imageConfig"))...)
	allErrs = append(allErrs, validateAndApplyPodConfig(&update.PodTemplate.Options.PodConfig, &wsk.Spec.PodTemplate.Options.PodConfig, optionsPath.Child("podConfig"))...)

	return allErrs
}

// applySpawnerMutate applies mutable spawner fields from the update to the CRD object.
func applySpawnerMutate(src *WorkspaceKindSpawnerMutate, dst *kubefloworgv1beta1.WorkspaceKindSpawner) {
	dst.DisplayName = src.DisplayName
	dst.Description = src.Description
	dst.Hidden = src.Hidden
	dst.Deprecated = src.Deprecated
	dst.DeprecationMessage = src.DeprecationMessage
	dst.Icon = kubefloworgv1beta1.WorkspaceKindIcon{
		Url:       src.Icon.Url,
		ConfigMap: src.Icon.ConfigMap,
	}
	dst.Logo = kubefloworgv1beta1.WorkspaceKindIcon{
		Url:       src.Logo.Url,
		ConfigMap: src.Logo.ConfigMap,
	}
}

// applyPodTemplateMutate applies mutable pod template fields from the update to the CRD object.
// Does NOT modify immutable fields: serviceAccount, volumeMounts.
func applyPodTemplateMutate(src *WorkspaceKindPodTemplateMutate, dst *kubefloworgv1beta1.WorkspaceKindPodTemplate) {
	if src.PodMetadata != nil {
		dst.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
			Labels:      copyStringMap(src.PodMetadata.Labels),
			Annotations: copyStringMap(src.PodMetadata.Annotations),
		}
	} else {
		dst.PodMetadata = nil
	}
	dst.Culling = src.Culling
	dst.Probes = src.Probes
	dst.Ports = src.Ports
	dst.ExtraEnv = src.ExtraEnv
	dst.ExtraVolumeMounts = src.ExtraVolumeMounts
	dst.ExtraVolumes = src.ExtraVolumes
	dst.SecurityContext = src.SecurityContext
	dst.ContainerSecurityContext = src.ContainerSecurityContext

	// options are handled separately by validateAndApply*Config
}

// validateAndApplyImageConfig validates and applies image config option changes.
// The update's values list is the complete desired state — options not in the update are dropped.
func validateAndApplyImageConfig(src *ImageConfigMutate, dst *kubefloworgv1beta1.ImageConfig, basePath *field.Path) field.ErrorList {
	var allErrs field.ErrorList

	// update the default
	dst.Spawner.Default = src.Spawner.Default

	// build lookup of existing options by ID
	existingByID := make(map[string]*kubefloworgv1beta1.ImageConfigValue, len(dst.Values))
	for i := range dst.Values {
		existingByID[dst.Values[i].Id] = &dst.Values[i]
	}

	// build new values list
	newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0, len(src.Values))
	for i, v := range src.Values {
		valPath := basePath.Child("values").Index(i)
		existing, isExisting := existingByID[v.Id]

		if isExisting {
			// existing option: validate immutable fields, apply only mutable fields
			errs := validateExistingImageConfigValue(&v, existing, valPath)
			allErrs = append(allErrs, errs...)

			// apply mutable fields to a copy of the existing value
			updated := *existing
			updated.Spawner.Hidden = v.Hidden
			updated.Redirect = v.Redirect
			newValues = append(newValues, updated)
		} else {
			// new option: spawner and spec are required
			if v.Spawner == nil {
				allErrs = append(allErrs, field.Required(valPath.Child("spawner"), fmt.Sprintf("spawner is required for new option %q", v.Id)))
			}
			if v.Spec == nil {
				allErrs = append(allErrs, field.Required(valPath.Child("spec"), fmt.Sprintf("spec is required for new option %q", v.Id)))
			}
			if v.Spawner != nil && v.Spec != nil {
				newValues = append(newValues, kubefloworgv1beta1.ImageConfigValue{
					Id:       v.Id,
					Spawner:  *v.Spawner,
					Redirect: v.Redirect,
					Spec:     *v.Spec,
				})
			}
		}
	}

	if len(allErrs) == 0 {
		dst.Values = newValues
	}

	return allErrs
}

// validateExistingImageConfigValue validates that immutable fields on existing options are not changed.
// NOTE: reflect.DeepEqual treats nil and empty slices/maps as different, but the K8s API server
// normalizes these values, so false positives should not occur for data round-tripped through K8s.
func validateExistingImageConfigValue(update *ImageConfigValueMutate, existing *kubefloworgv1beta1.ImageConfigValue, valPath *field.Path) field.ErrorList {
	var allErrs field.ErrorList

	if update.Spawner != nil && !reflect.DeepEqual(*update.Spawner, existing.Spawner) {
		allErrs = append(allErrs, field.Forbidden(valPath.Child("spawner"), fmt.Sprintf("spawner is immutable for existing option %q", update.Id)))
	}
	if update.Spec != nil && !reflect.DeepEqual(*update.Spec, existing.Spec) {
		allErrs = append(allErrs, field.Forbidden(valPath.Child("spec"), fmt.Sprintf("spec is immutable for existing option %q", update.Id)))
	}

	return allErrs
}

// validateAndApplyPodConfig validates and applies pod config option changes.
// The update's values list is the complete desired state — options not in the update are dropped.
func validateAndApplyPodConfig(src *PodConfigMutate, dst *kubefloworgv1beta1.PodConfig, basePath *field.Path) field.ErrorList {
	var allErrs field.ErrorList

	// update the default
	dst.Spawner.Default = src.Spawner.Default

	// build lookup of existing options by ID
	existingByID := make(map[string]*kubefloworgv1beta1.PodConfigValue, len(dst.Values))
	for i := range dst.Values {
		existingByID[dst.Values[i].Id] = &dst.Values[i]
	}

	// build new values list
	newValues := make([]kubefloworgv1beta1.PodConfigValue, 0, len(src.Values))
	for i, v := range src.Values {
		valPath := basePath.Child("values").Index(i)
		existing, isExisting := existingByID[v.Id]

		if isExisting {
			// existing option: validate immutable fields, apply only mutable fields
			errs := validateExistingPodConfigValue(&v, existing, valPath)
			allErrs = append(allErrs, errs...)

			// apply mutable fields to a copy of the existing value
			updated := *existing
			updated.Spawner.Hidden = v.Hidden
			updated.Redirect = v.Redirect
			newValues = append(newValues, updated)
		} else {
			// new option: spawner and spec are required
			if v.Spawner == nil {
				allErrs = append(allErrs, field.Required(valPath.Child("spawner"), fmt.Sprintf("spawner is required for new option %q", v.Id)))
			}
			if v.Spec == nil {
				allErrs = append(allErrs, field.Required(valPath.Child("spec"), fmt.Sprintf("spec is required for new option %q", v.Id)))
			}
			if v.Spawner != nil && v.Spec != nil {
				newValues = append(newValues, kubefloworgv1beta1.PodConfigValue{
					Id:       v.Id,
					Spawner:  *v.Spawner,
					Redirect: v.Redirect,
					Spec:     *v.Spec,
				})
			}
		}
	}

	if len(allErrs) == 0 {
		dst.Values = newValues
	}

	return allErrs
}

// validateExistingPodConfigValue validates that immutable fields on existing options are not changed.
// NOTE: reflect.DeepEqual treats nil and empty slices/maps as different, but the K8s API server
// normalizes these values, so false positives should not occur for data round-tripped through K8s.
func validateExistingPodConfigValue(update *PodConfigValueMutate, existing *kubefloworgv1beta1.PodConfigValue, valPath *field.Path) field.ErrorList {
	var allErrs field.ErrorList

	if update.Spawner != nil && !reflect.DeepEqual(*update.Spawner, existing.Spawner) {
		allErrs = append(allErrs, field.Forbidden(valPath.Child("spawner"), fmt.Sprintf("spawner is immutable for existing option %q", update.Id)))
	}
	if update.Spec != nil && !reflect.DeepEqual(*update.Spec, existing.Spec) {
		allErrs = append(allErrs, field.Forbidden(valPath.Child("spec"), fmt.Sprintf("spec is immutable for existing option %q", update.Id)))
	}

	return allErrs
}
