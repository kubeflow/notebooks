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

/*
===============================================================================
                               Workspace - Spec
===============================================================================
*/

// WorkspaceSpec defines the desired state of Workspace
type WorkspaceSpec struct {

	// if the workspace is paused (no pods running)
	// +kubebuilder:validation:Optional
	// +kubebuilder:default=false
	Paused *bool `json:"paused,omitempty"`

	// if true, pending updates are NOT applied when the Workspace is paused
	// if false, pending updates are applied when the Workspace is paused
	// +kubebuilder:validation:Optional
	// +kubebuilder:default=false
	DeferUpdates *bool `json:"deferUpdates,omitempty"`

	// the WorkspaceKind to use
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=63
	// +kubebuilder:validation:Pattern:=^[a-z0-9][-a-z0-9]*[a-z0-9]$
	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="Workspace 'kind' is immutable"
	// +kubebuilder:example="jupyterlab"
	Kind string `json:"kind"`

	// options for "podTemplate"-type WorkspaceKinds
	PodTemplate WorkspacePodTemplate `json:"podTemplate"`
}

type WorkspacePodTemplate struct {
	// metadata to be applied to the Pod resource
	// +kubebuilder:validation:Optional
	PodMetadata *WorkspacePodMetadata `json:"podMetadata,omitempty"`

	// volume configs
	Volumes WorkspacePodVolumes `json:"volumes"`

	// the selected podTemplate options
	Options WorkspacePodOptions `json:"options"`
}

type WorkspacePodMetadata struct {
	// labels to be applied to the Pod resource
	// +kubebuilder:validation:Optional
	Labels map[string]string `json:"labels,omitempty"`

	// annotations to be applied to the Pod resource
	// +kubebuilder:validation:Optional
	Annotations map[string]string `json:"annotations,omitempty"`
}

type WorkspacePodVolumes struct {
	// the name of the PVC to mount as the home volume
	//  - this PVC must already exist in the Namespace
	//  - this PVC must be RWX (ReadWriteMany, ReadWriteOnce)
	//  - the mount path is defined in the WorkspaceKind under
	//    `spec.podTemplate.volumeMounts.home`
	// +kubebuilder:validation:Optional
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=63
	// +kubebuilder:validation:Pattern:=^[a-z0-9][-a-z0-9]*[a-z0-9]$
	// +kubebuilder:example="my-home-pvc"
	Home *string `json:"home,omitempty"`

	// additional PVCs to mount
	//  - these PVC must already exist in the Namespace
	//  - the same PVC can be mounted multiple times with different `mountPaths`
	//  - if `readOnly` is false, the PVC must be RWX (ReadWriteMany, ReadWriteOnce)
	//  - if `readOnly` is true, the PVC must be ReadOnlyMany
	// +kubebuilder:validation:Optional
	// +listType:="map"
	// +listMapKey:="mountPath"
	Data []PodVolumeMount `json:"data,omitempty"`
}

type PodVolumeMount struct {
	// the name of the PVC to mount
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=63
	// +kubebuilder:validation:Pattern:=^[a-z0-9][-a-z0-9]*[a-z0-9]$
	// +kubebuilder:example="my-data-pvc"
	PVCName string `json:"pvcName"`

	// the mount path for the PVC
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=4096
	// +kubebuilder:validation:Pattern:=^/[^/].*$
	// +kubebuilder:example="/data/my-data"
	MountPath string `json:"mountPath"`

	// if the PVC should be mounted as ReadOnly
	// +kubebuilder:validation:Optional
	// +kubebuilder:default=false
	ReadOnly *bool `json:"readOnly,omitempty"`
}

type WorkspacePodOptions struct {
	// the id of an imageConfig option
	//  - options are defined in WorkspaceKind under
	//    `spec.podTemplate.options.imageConfig.values[]`
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="jupyterlab_scipy_190"
	ImageConfig string `json:"imageConfig"`

	// the id of a podConfig option
	//  - options are defined in WorkspaceKind under
	//    `spec.podTemplate.options.podConfig.values[]`
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="big_gpu"
	PodConfig string `json:"podConfig"`
}

/*
===============================================================================
                              Workspace - Status
===============================================================================
*/

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	// activity information for the Workspace, used to determine when to cull
	Activity WorkspaceActivity `json:"activity"`

	// the time when the Workspace was paused (UNIX epoch)
	//  - set to 0 when the Workspace is NOT paused
	// +kubebuilder:default=0
	// +kubebuilder:example=1704067200
	PauseTime int64 `json:"pauseTime"`

	// if the current Pod does not reflect the current "desired" state
	//  - true if any `spec.podTemplate.options` have a redirect
	//    and so will be patched on the next restart
	//  - true if the WorkspaceKind has changed one of its common `podTemplate` fields
	//    like `podMetadata`, `probes`, `extraEnv`, or `containerSecurityContext`
	// +kubebuilder:default=false
	PendingRestart bool `json:"pendingRestart"`

	// information about the current podTemplate options
	PodTemplateOptions WorkspacePodOptionsStatus `json:"podTemplateOptions"`

	// the current state of the Workspace
	// +kubebuilder:default="Unknown"
	State WorkspaceState `json:"state"`

	// a human-readable message about the state of the Workspace
	//  - WARNING: this field is NOT FOR MACHINE USE, subject to change without notice
	// +kubebuilder:default=""
	StateMessage string `json:"stateMessage"`
}

type WorkspaceActivity struct {
	// the last time activity was observed on the Workspace (UNIX epoch)
	// +kubebuilder:default=0
	// +kubebuilder:example=1704067200
	LastActivity int64 `json:"lastActivity"`

	// the last time we checked for activity on the Workspace (UNIX epoch)
	// +kubebuilder:default=0
	// +kubebuilder:example=1704067200
	LastUpdate int64 `json:"lastUpdate"`
}

type WorkspacePodOptionsStatus struct {
	// info about the current imageConfig option
	ImageConfig WorkspacePodOptionInfo `json:"imageConfig"`

	// info about the current podConfig option
	PodConfig WorkspacePodOptionInfo `json:"podConfig"`
}

type WorkspacePodOptionInfo struct {
	// the option id which will take effect after the next restart
	// +kubebuilder:validation:Optional
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	Desired string `json:"desired,omitempty"`

	// the chain from the current option to the desired option
	// +kubebuilder:validation:Optional
	RedirectChain []WorkspacePodOptionRedirectStep `json:"redirectChain,omitempty"`
}

type WorkspacePodOptionRedirectStep struct {
	// the source option id
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	Source string `json:"source"`

	// the target option id
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	Target string `json:"target"`
}

// +kubebuilder:validation:Enum:={"Running","Terminating","Paused","Pending","Error","Unknown"}
type WorkspaceState string

const (
	WorkspaceStateRunning     WorkspaceState = "Running"
	WorkspaceStateTerminating WorkspaceState = "Terminating"
	WorkspaceStatePaused      WorkspaceState = "Paused"
	WorkspaceStatePending     WorkspaceState = "Pending"
	WorkspaceStateError       WorkspaceState = "Error"
	WorkspaceStateUnknown     WorkspaceState = "Unknown"
)

/*
===============================================================================
                                   Workspace
===============================================================================
*/

// +kubebuilder:object:root=true
// +kubebuilder:printcolumn:name="State",type="string",JSONPath=".status.state",description="The current state of the Workspace"
// +kubebuilder:subresource:status

// Workspace is the Schema for the Workspaces API
type Workspace struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WorkspaceSpec   `json:"spec,omitempty"`
	Status WorkspaceStatus `json:"status,omitempty"`
}

/*
===============================================================================
                                 WorkspaceList
===============================================================================
*/

// +kubebuilder:object:root=true

// WorkspaceList contains a list of Workspace
type WorkspaceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Workspace `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Workspace{}, &WorkspaceList{})
}
