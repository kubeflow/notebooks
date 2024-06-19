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

package v1beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Important: Run "make" to regenerate code after modifying this file
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// WorkspaceSpec defines the desired state of Workspace
type WorkspaceSpec struct {

	// if the workspace should be paused (no pods running)
	//+kubebuilder:default=false
	//+kubebuilder:validation:Optional
	Paused bool `json:"paused,omitempty"`

	// the WorkspaceKind to use
	//+kubebuilder:validation:Required
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=63
	//+kubebuilder:validation:Pattern:=^[a-z0-9][-a-z0-9]*[a-z0-9]$
	//+kubebuilder:validation:XValidation:rule="self == oldSelf",message="Workspace 'kind' is immutable"
	//+kubebuilder:example="jupyter-lab"
	Kind string `json:"kind"`

	// options for "podTemplate"-type WorkspaceKinds
	PodTemplate PodTemplate `json:"podTemplate"`
}

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {

	// information populated by activity probes, used to determine when to cull
	Activity Activity `json:"activity"`

	// the time when the Workspace was paused, 0 if the Workspace is not paused
	//+kubebuilder:example=1704067200
	PauseTime int64 `json:"pauseTime"`

	// if the current Pod does not reflect the current "desired" state (after redirects)
	//+kubebuilder:example=false
	PendingRestart bool `json:"pendingRestart"`

	// actual "target" podTemplateOptions, taking into account redirects
	PodTemplateOptions Options `json:"podTemplateOptions"`

	// the current state of the Workspace
	//+kubebuilder:validation:Enum:={"Running","Terminating","Paused","Pending","Error","Unknown"}
	//+kubebuilder:example="Running"
	State string `json:"state"`

	// a human-readable message about the state of the Workspace
	//  WARNING: this field is NOT FOR MACHINE USE, subject to change without notice
	//+kubebuilder:example="Pod is not ready"
	StateMessage string `json:"stateMessage"`
}

//+kubebuilder:object:root=true
//+kubebuilder:printcolumn:name="State",type="string",JSONPath=".status.state",description="The current state of the Workspace"
//+kubebuilder:subresource:status

// Workspace is the Schema for the workspaces API
type Workspace struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WorkspaceSpec   `json:"spec,omitempty"`
	Status WorkspaceStatus `json:"status,omitempty"`
}

//+kubebuilder:object:root=true

// WorkspaceList contains a list of Workspace
type WorkspaceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Workspace `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Workspace{}, &WorkspaceList{})
}

type PodTemplate struct {
	// metadata to be applied to the Pod resource
	//+kubebuilder:validation:Optional
	PodMetadata PodMetadata `json:"podMetadata,omitempty"`

	// volume configs
	Volumes PodVolumes `json:"volumes"`

	// spawner options, these are the user-selected options from the Workspace Spawner UI which determine the PodSpec of the Workspace Pod
	Options Options `json:"options"`
}

type PodMetadata struct {
	// labels to be applied to the Pod resource
	//+kubebuilder:validation:Optional
	Labels map[string]string `json:"labels,omitempty"`

	// annotations to be applied to the Pod resource
	//+kubebuilder:validation:Optional
	Annotations map[string]string `json:"annotations,omitempty"`
}

type PodVolumes struct {
	// A PVC to mount as the home directory.
	// This PVC must already exist in the Namespace
	// This PVC must be RWX (ReadWriteMany, ReadWriteOnce)
	// Mount path is defined in the WorkspaceKind under `spec.podTemplate.volumeMounts.home`
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=63
	//+kubebuilder:validation:Pattern:=^[a-z0-9][-a-z0-9]*[a-z0-9]$
	//+kubebuilder:example="my-home-pvc"
	Home string `json:"home"`

	// additional data PVCs to mount, these PVCs must already exist in the Namespace
	//+kubebuilder:validation:Optional
	Data []PodVolumeMount `json:"data,omitempty"`
}

type PodVolumeMount struct {
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=63
	//+kubebuilder:validation:Pattern:=^[a-z0-9][-a-z0-9]*[a-z0-9]$
	//+kubebuilder:example="my-data-pvc"
	Name string `json:"name"`

	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=4096
	//+kubebuilder:validation:Pattern:=^/[^/].*$
	//+kubebuilder:example="/data/my-data"
	MountPath string `json:"mountPath"`
}

type Activity struct {
	//+kubebuilder:example=1704067200
	LastActivity int64 `json:"lastActivity"`

	//+kubebuilder:example=1704067200
	LastUpdate int64 `json:"lastUpdate"`
}

type Options struct {
	// the id of an image option
	//  - options are defined in WorkspaceKind under
	//    `spec.podTemplate.options.imageConfig.values[]`
	//+kubebuilder:example="jupyter_scipy_170"
	ImageConfig string `json:"imageConfig"`

	//+kubebuilder:example="big_gpu"
	PodConfig string `json:"podConfig"`
}
