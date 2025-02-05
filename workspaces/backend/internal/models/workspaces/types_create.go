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
	DeferUpdates bool              `json:"defer_updates"`
	PodTemplate  PodTemplateMutate `json:"pod_template"`
}

type PodTemplateMutate struct {
	PodMetadata PodMetadataMutate        `json:"pod_metadata"`
	Volumes     PodVolumesMutate         `json:"volumes"`
	Options     PodTemplateOptionsMutate `json:"options"`
}

type PodMetadataMutate struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type PodVolumesMutate struct {
	Home *string          `json:"home,omitempty"`
	Data []PodVolumeMount `json:"data"`
}

type PodVolumeMount struct {
	PVCName   string `json:"pvc_name"`
	MountPath string `json:"mount_path"`
	ReadOnly  bool   `json:"read_only,omitempty"`
}

type PodTemplateOptionsMutate struct {
	ImageConfig string `json:"image_config"`
	PodConfig   string `json:"pod_config"`
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
	imageConfigPath := prefix.Child("pod_template", "options", "image_config")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(imageConfigPath, w.PodTemplate.Options.ImageConfig)...)

	// validate the pod config
	podConfigPath := prefix.Child("pod_template", "options", "pod_config")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(podConfigPath, w.PodTemplate.Options.PodConfig)...)

	// validate the data volumes
	dataVolumesPath := prefix.Child("pod_template", "volumes", "data")
	for i, volume := range w.PodTemplate.Volumes.Data {
		volumePath := dataVolumesPath.Index(i)
		errs = append(errs, helper.ValidateFieldIsNotEmpty(volumePath.Child("pvc_name"), volume.PVCName)...)
		errs = append(errs, helper.ValidateFieldIsNotEmpty(volumePath.Child("mount_path"), volume.MountPath)...)
	}

	return errs
}
