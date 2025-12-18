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
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// WorkspaceCreate is used to create a new workspace.
type WorkspaceCreate struct {
	Name         string            `json:"name"`
	Kind         string            `json:"kind"`
	Paused       bool              `json:"paused"`
	DeferUpdates bool              `json:"deferUpdates"`
	PodTemplate  PodTemplateMutate `json:"podTemplate"`
}

// Validate validates the WorkspaceCreate struct.
// NOTE: we only do basic validation, more complex validation is done by the controller when attempting to create the workspace.
func (w *WorkspaceCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the workspace name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateWorkspaceName(namePath, w.Name)...)

	// validate the workspace kind name
	kindPath := prefix.Child("kind")
	errs = append(errs, helper.ValidateWorkspaceKindName(kindPath, w.Kind)...)

	// validate pod template
	podTemplatePath := prefix.Child("podTemplate")
	errs = append(errs, w.PodTemplate.Validate(podTemplatePath)...)

	return errs
}

// WorkspaceUpdate is used to update an existing workspace.
// NOTE: we only do basic validation, more complex validation is done by the controller when attempting to update the workspace.
type WorkspaceUpdate struct {
	// Revision is an opaque token that can be treated like an etag.
	// - Clients receive this value from GET requests and must include it
	//   in update requests to ensure they are updating the expected version.
	// - Clients must not parse, interpret, or compare revision values
	//   other than for equality, as the format is not guaranteed to be stable.
	Revision string `json:"revision"`

	Paused       bool              `json:"paused"`       // TODO: remove `paused` once we have an "actions" api for pausing workspaces
	DeferUpdates bool              `json:"deferUpdates"` // TODO: remove `deferUpdates` once the controller is no longer applying redirects
	PodTemplate  PodTemplateMutate `json:"podTemplate"`
}

// Validate validates the WorkspaceUpdate struct.
func (w *WorkspaceUpdate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// Validate revision is present
	revisionPath := prefix.Child("revision")
	if w.Revision == "" {
		errs = append(errs, field.Required(revisionPath, "revision is required"))
	}

	// validate pod template
	podTemplatePath := prefix.Child("podTemplate")
	errs = append(errs, w.PodTemplate.Validate(podTemplatePath)...)

	return errs
}

type PodTemplateMutate struct {
	PodMetadata PodMetadataMutate        `json:"podMetadata"`
	Volumes     PodVolumesMutate         `json:"volumes"`
	Options     PodTemplateOptionsMutate `json:"options"`
}

// Validate validates the PodTemplateMutate struct.
func (p *PodTemplateMutate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the pod metadata
	podMetadataPath := prefix.Child("podMetadata")
	errs = append(errs, p.PodMetadata.Validate(podMetadataPath)...)

	// validate the volumes
	volumesPath := prefix.Child("volumes")
	errs = append(errs, p.Volumes.Validate(volumesPath)...)

	// validate the options
	optionsPath := prefix.Child("options")
	errs = append(errs, p.Options.Validate(optionsPath)...)

	return errs
}

// TODO: figure out how we want to handle labels/annotations
//   - we do not want users to be able to set labels/annotations
//   - but we probably want them to be returned in the response
type PodMetadataMutate struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

// Validate validates the PodMetadataMutate struct.
func (p *PodMetadataMutate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the labels
	labelsPath := prefix.Child("labels")
	errs = append(errs, helper.ValidateKubernetesLabels(labelsPath, p.Labels)...)

	// validate the annotations
	annotationsPath := prefix.Child("annotations")
	errs = append(errs, helper.ValidateKubernetesAnnotations(annotationsPath, p.Annotations)...)

	return errs
}

type PodVolumesMutate struct {
	Home    *string          `json:"home,omitempty"`
	Data    []PodVolumeMount `json:"data"`
	Secrets []PodSecretMount `json:"secrets,omitempty"`
}

// Validate validates the PodVolumesMutate struct.
func (p *PodVolumesMutate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the data volumes
	dataVolumesPath := prefix.Child("data")
	for i, volume := range p.Data {
		volumePath := dataVolumesPath.Index(i)
		errs = append(errs, volume.Validate(volumePath)...)
	}

	// validate the secrets
	secretsPath := prefix.Child("secrets")
	for i, secret := range p.Secrets {
		secretPath := secretsPath.Index(i)
		errs = append(errs, secret.Validate(secretPath)...)
	}

	return errs
}

type PodVolumeMount struct {
	PVCName   string `json:"pvcName"`
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly,omitempty"`
}

// Validate validates the PodVolumeMount struct.
func (p *PodVolumeMount) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the PVC name
	pvcNamePath := prefix.Child("pvcName")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(pvcNamePath, p.PVCName)...)

	// validate the mount path
	mountPath := prefix.Child("mountPath")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(mountPath, p.MountPath)...)

	return errs
}

type PodSecretMount struct {
	SecretName  string `json:"secretName"`
	MountPath   string `json:"mountPath"`
	DefaultMode int32  `json:"defaultMode,omitempty"`
}

// Validate validates the PodSecretMount struct.
func (p *PodSecretMount) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the secret name
	secretNamePath := prefix.Child("secretName")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(secretNamePath, p.SecretName)...)

	// validate the mount path
	mountPath := prefix.Child("mountPath")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(mountPath, p.MountPath)...)

	// validate the default mode
	defaultModePath := prefix.Child("defaultMode")
	if p.DefaultMode != 0 {
		if p.DefaultMode < 0 || p.DefaultMode > 511 {
			errs = append(errs, field.Invalid(defaultModePath, p.DefaultMode, "defaultMode must be between 0 and 511"))
		}
	}

	return errs
}

type PodTemplateOptionsMutate struct {
	ImageConfig string `json:"imageConfig"`
	PodConfig   string `json:"podConfig"`
}

// Validate validates the PodTemplateOptionsMutate struct.
func (p *PodTemplateOptionsMutate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the image config
	imageConfigPath := prefix.Child("imageConfig")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(imageConfigPath, p.ImageConfig)...)

	// validate the pod config
	podConfigPath := prefix.Child("podConfig")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(podConfigPath, p.PodConfig)...)

	return errs
}
