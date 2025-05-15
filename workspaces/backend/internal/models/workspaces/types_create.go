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

type PodTemplateMutate struct {
	PodMetadata PodMetadataMutate        `json:"podMetadata"`
	Volumes     PodVolumesMutate         `json:"volumes"`
	Options     PodTemplateOptionsMutate `json:"options"`
}

type PodMetadataMutate struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type PodVolumesMutate struct {
	Home    *string          `json:"home,omitempty"`
	Data    []PodVolumeMount `json:"data"`
	Secrets []PodSecretMount `json:"secrets,omitempty"`
}

type PodVolumeMount struct {
	PVCName   string `json:"pvcName"`
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly,omitempty"`
}

type PodSecretMount struct {
	SecretName  string `json:"secretName"`
	MountPath   string `json:"mountPath"`
	DefaultMode int32  `json:"defaultMode,omitempty"`
}

type PodTemplateOptionsMutate struct {
	ImageConfig string `json:"imageConfig"`
	PodConfig   string `json:"podConfig"`
}

// Validate validates the WorkspaceCreate struct.
// NOTE: we only do basic validation, more complex validation is done by the controller when attempting to create the workspace.
func (w *WorkspaceCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the workspace name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateFieldIsDNS1123Subdomain(namePath, w.Name)...)

	// validate the workspace kind name
	kindPath := prefix.Child("kind")
	errs = append(errs, helper.ValidateFieldIsDNS1123Subdomain(kindPath, w.Kind)...)

	// validate the image config
	imageConfigPath := prefix.Child("podTemplate", "options", "imageConfig")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(imageConfigPath, w.PodTemplate.Options.ImageConfig)...)

	// validate the pod config
	podConfigPath := prefix.Child("podTemplate", "options", "podConfig")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(podConfigPath, w.PodTemplate.Options.PodConfig)...)

	// validate the data volumes
	dataVolumesPath := prefix.Child("podTemplate", "volumes", "data")
	for i, volume := range w.PodTemplate.Volumes.Data {
		volumePath := dataVolumesPath.Index(i)
		errs = append(errs, helper.ValidateFieldIsNotEmpty(volumePath.Child("pvcName"), volume.PVCName)...)
		errs = append(errs, helper.ValidateFieldIsNotEmpty(volumePath.Child("mountPath"), volume.MountPath)...)
	}

	// validate the secrets
	secretsPath := prefix.Child("podTemplate", "volumes", "secrets")
	for i, secret := range w.PodTemplate.Volumes.Secrets {
		secretPath := secretsPath.Index(i)
		errs = append(errs, helper.ValidateFieldIsNotEmpty(secretPath.Child("secretName"), secret.SecretName)...)
		errs = append(errs, helper.ValidateFieldIsNotEmpty(secretPath.Child("mountPath"), secret.MountPath)...)
		if secret.DefaultMode != 0 {
			if secret.DefaultMode < 0 || secret.DefaultMode > 511 {
				errs = append(errs, field.Invalid(secretPath.Child("defaultMode"), secret.DefaultMode, "defaultMode must be between 0 and 511"))
			}
		}
	}

	return errs
}
