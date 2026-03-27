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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// WorkspaceKindUpdate exposes only mutable fields for updating an existing workspace kind.
// Immutable fields (serviceAccount.name, volumeMounts.home) are excluded.
// NOTE: we only do basic validation, more complex validation is done by the controller.
type WorkspaceKindUpdate struct {
	// Revision is an opaque token for optimistic locking.
	Revision string `json:"revision"`

	// Spawner contains mutable spawner fields.
	Spawner WorkspaceKindSpawnerMutate `json:"spawner"`

	// PodTemplate contains mutable pod template fields.
	PodTemplate WorkspaceKindPodTemplateMutate `json:"podTemplate"`
}

// Validate validates the WorkspaceKindUpdate struct.
func (w *WorkspaceKindUpdate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate revision is present
	revisionPath := prefix.Child("revision")
	if w.Revision == "" {
		errs = append(errs, field.Required(revisionPath, "revision is required"))
	}

	// NOTE: all other validation is deferred to the Kubernetes API server

	return errs
}

// WorkspaceKindSpawnerMutate contains the mutable spawner fields.
type WorkspaceKindSpawnerMutate struct {
	DisplayName        string                  `json:"displayName"`
	Description        string                  `json:"description"`
	Hidden             *bool                   `json:"hidden,omitempty"`
	Deprecated         *bool                   `json:"deprecated,omitempty"`
	DeprecationMessage *string                 `json:"deprecationMessage,omitempty"`
	Icon               WorkspaceKindIconMutate `json:"icon"`
	Logo               WorkspaceKindIconMutate `json:"logo"`
}

// WorkspaceKindIconMutate represents a mutable icon (url or configMap).
type WorkspaceKindIconMutate struct {
	Url       *string                                    `json:"url,omitempty"`
	ConfigMap *kubefloworgv1beta1.WorkspaceKindConfigMap `json:"configMap,omitempty"`
}

// WorkspaceKindPodTemplateMutate contains the mutable pod template fields.
// Excludes immutable fields: serviceAccount, volumeMounts.
type WorkspaceKindPodTemplateMutate struct {
	PodMetadata              *WorkspaceKindPodMetadataMutate                `json:"podMetadata,omitempty"`
	Culling                  *kubefloworgv1beta1.WorkspaceKindCullingConfig `json:"culling,omitempty"`
	Probes                   *kubefloworgv1beta1.WorkspaceKindProbes        `json:"probes,omitempty"`
	Ports                    []kubefloworgv1beta1.WorkspaceKindPort         `json:"ports,omitempty"`
	ExtraEnv                 []corev1.EnvVar                                `json:"extraEnv,omitempty"`
	ExtraVolumeMounts        []corev1.VolumeMount                           `json:"extraVolumeMounts,omitempty"`
	ExtraVolumes             []corev1.Volume                                `json:"extraVolumes,omitempty"`
	SecurityContext          *corev1.PodSecurityContext                     `json:"securityContext,omitempty"`
	ContainerSecurityContext *corev1.SecurityContext                        `json:"containerSecurityContext,omitempty"`
	Options                  WorkspaceKindOptionsMutate                     `json:"options"`
}

// WorkspaceKindPodMetadataMutate contains mutable pod metadata.
type WorkspaceKindPodMetadataMutate struct {
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// WorkspaceKindOptionsMutate contains mutable option configs.
type WorkspaceKindOptionsMutate struct {
	ImageConfig ImageConfigMutate `json:"imageConfig"`
	PodConfig   PodConfigMutate   `json:"podConfig"`
}

// ImageConfigMutate contains the mutable image config fields.
type ImageConfigMutate struct {
	Spawner OptionSpawnerConfigMutate `json:"spawner"`
	Values  []ImageConfigValueMutate  `json:"values"`
}

// PodConfigMutate contains the mutable pod config fields.
type PodConfigMutate struct {
	Spawner OptionSpawnerConfigMutate `json:"spawner"`
	Values  []PodConfigValueMutate    `json:"values"`
}

// OptionSpawnerConfigMutate contains the mutable spawner config (default selection).
type OptionSpawnerConfigMutate struct {
	Default string `json:"default"`
}

// ImageConfigValueMutate represents a mutable image config option value.
// For existing options: only Hidden and Redirect are applied (Spawner/Spec are ignored if unchanged).
// For new options: Spawner and Spec must be provided.
type ImageConfigValueMutate struct {
	Id       string                                `json:"id"`
	Hidden   *bool                                 `json:"hidden,omitempty"`
	Redirect *kubefloworgv1beta1.OptionRedirect    `json:"redirect,omitempty"`
	Spawner  *kubefloworgv1beta1.OptionSpawnerInfo `json:"spawner,omitempty"`
	Spec     *kubefloworgv1beta1.ImageConfigSpec   `json:"spec,omitempty"`
}

// PodConfigValueMutate represents a mutable pod config option value.
// For existing options: only Hidden and Redirect are applied (Spawner/Spec are ignored if unchanged).
// For new options: Spawner and Spec must be provided.
type PodConfigValueMutate struct {
	Id       string                                `json:"id"`
	Hidden   *bool                                 `json:"hidden,omitempty"`
	Redirect *kubefloworgv1beta1.OptionRedirect    `json:"redirect,omitempty"`
	Spawner  *kubefloworgv1beta1.OptionSpawnerInfo `json:"spawner,omitempty"`
	Spec     *kubefloworgv1beta1.PodConfigSpec     `json:"spec,omitempty"`
}
