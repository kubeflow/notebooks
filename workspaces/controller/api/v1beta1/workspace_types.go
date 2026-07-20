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

	// the WorkspaceKind to use
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
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
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
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

	// secrets to mount
	//  - these secrets must already exist in the Namespace
	//  - secrets are mounted as folders with the secret keys as files
	// +kubebuilder:validation:Optional
	// +listType:="map"
	// +listMapKey:="mountPath"
	Secrets []PodSecretMount `json:"secrets,omitempty"`
}

type PodVolumeMount struct {
	// the name of the PVC to mount
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
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

type PodSecretMount struct {
	// the name of the Secret to mount
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
	// +kubebuilder:example="my-secret"
	SecretName string `json:"secretName"`

	// the mount path for the Secret
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=4096
	// +kubebuilder:validation:Pattern:=^/[^/].*$
	// +kubebuilder:example="/secrets/my-secret"
	MountPath string `json:"mountPath"`

	// default mode bits used to set permissions on files in the Secret
	//  - must be a decimal value between 0 and 511, or an octal value between 0000 and 0777
	//  - for example, 420 is equivalent to 0644, and 511 is equivalent to 0777
	//  - YAML accepts both octal and decimal values, JSON requires decimal
	//  - Defaults to 420 (octal: 0644) if not specified.
	// +kubebuilder:validation:Optional
	// +kubebuilder:validation:Minimum:=0
	// +kubebuilder:validation:Maximum:=511
	// +kubebuilder:default=420
	DefaultMode int32 `json:"defaultMode,omitempty"`
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

	// information about the current podTemplate options (only set for WorkspaceKind of podTemplate kind)
	PodTemplateOptions WorkspacePodOptionsStatus `json:"podTemplateOptions"`

	// information about the Pod managed by this Workspace (only set for WorkspaceKind of podTemplate kind)
	PodTemplatePod WorkspacePodStatus `json:"podTemplatePod"`

	// the current state of the Workspace
	//  - this is a summary enum derived from `conditions` (see the derivation
	//    rules documented on the WorkspaceConditionType constants below)
	// +kubebuilder:default="Unknown"
	State WorkspaceState `json:"state"`

	// a human-readable message about the state of the Workspace
	//  - WARNING: this field is NOT FOR MACHINE USE, subject to change without notice
	// +kubebuilder:default=""
	StateMessage string `json:"stateMessage"`

	// structured sub-states that independently track distinct aspects of Workspace health
	//  - each condition `type` is unique in this list (there is only ever one entry per type)
	//  - the summary `state` field is derived deterministically from these conditions
	//  - each condition owns a disjoint set of `reason` values (documented on the
	//    WorkspaceConditionType and reason constants below)
	//  - new signals (e.g. volume binding, activity probes) are added as new condition
	//    types without restructuring the existing conditions
	// +kubebuilder:validation:Optional
	// +listType=map
	// +listMapKey=type
	// +patchStrategy=merge
	// +patchMergeKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type"`
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

type WorkspacePodStatus struct {
	// the name of the Pod resource
	Name string `json:"name"`

	// the name of the node on which the Pod is scheduled
	NodeName string `json:"nodeName"`

	// information about the Pod's containers
	// +kubebuilder:validation:Optional
	Containers []WorkspacePodContainer `json:"containers,omitempty"`

	// information about the Pod's initContainers
	// +kubebuilder:validation:Optional
	InitContainers []WorkspacePodContainer `json:"initContainers,omitempty"`
}

type WorkspacePodContainer struct {
	// the name of the container
	Name string `json:"name"`
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

// WorkspaceConditionType identifies a sub-state tracked in `status.conditions`.
//
// Each type is a single, independent health dimension. There is exactly one
// condition entry per type in `status.conditions`; its `status`, `reason`, and
// `message` are updated in place as the dimension changes over time.
//
// Summary `state` derivation (first matching rule wins, preserving prior behavior):
//
//  1. Workspace is paused                                    -> Paused
//  2. Pod is terminating                                     -> Terminating
//  3. ConfigResolved=False OR ResourcesProvisioned=False     -> Error   (config)
//  4. PodScheduled=False                                     -> Error   (scheduling)
//  5. WorkspaceReady=False with reason CrashLoopBackOff,
//     ImagePullBackOff, PodWarningEvent, StatefulSetWarningEvent -> Error (runtime)
//  6. WorkspaceReady=False with reason Pending               -> Pending
//  7. WorkspaceReady=True                                    -> Running
//  8. otherwise                                              -> Unknown
type WorkspaceConditionType string

const (
	// WorkspaceConditionConfigResolved is True when the referenced WorkspaceKind
	// and the selected imageConfig/podConfig options all resolve successfully.
	// Reasons when False: Resolved, WorkspaceKindNotFound, InvalidImageConfig, InvalidPodConfig.
	WorkspaceConditionConfigResolved WorkspaceConditionType = "ConfigResolved"

	// WorkspaceConditionResourcesProvisioned is True when the owned resources
	// (StatefulSet, Service, VirtualService) are generated, singular, and owned.
	// Reasons when False: Provisioned, StatefulSetGenerationFailed, ServiceGenerationFailed,
	// VirtualServiceGenerationFailed, DuplicateResources, ControllerReferenceFailed.
	WorkspaceConditionResourcesProvisioned WorkspaceConditionType = "ResourcesProvisioned"

	// WorkspaceConditionPodScheduled is True when the Pod has been scheduled to a node.
	// Reasons when False: Scheduled, Unschedulable, SchedulingGated, SchedulerError.
	WorkspaceConditionPodScheduled WorkspaceConditionType = "PodScheduled"

	// WorkspaceConditionWorkspaceReady is True when the Pod is Running and Ready.
	// Reasons when False: Running, Pending, CrashLoopBackOff, ImagePullBackOff,
	// PodWarningEvent, StatefulSetWarningEvent.
	WorkspaceConditionWorkspaceReady WorkspaceConditionType = "WorkspaceReady"

	// Future signals (e.g. volume binding, Activity Rules probes, DRA resource claims) can be
	// added as new condition types without restructuring the existing ones.
)

const (
	// reasons for the ConfigResolved condition
	WorkspaceConditionReasonResolved              = "Resolved"
	WorkspaceConditionReasonWorkspaceKindNotFound = "WorkspaceKindNotFound"
	WorkspaceConditionReasonInvalidImageConfig    = "InvalidImageConfig"
	WorkspaceConditionReasonInvalidPodConfig      = "InvalidPodConfig"

	// reasons for the ResourcesProvisioned condition
	WorkspaceConditionReasonProvisioned                    = "Provisioned"
	WorkspaceConditionReasonStatefulSetGenerationFailed    = "StatefulSetGenerationFailed"
	WorkspaceConditionReasonServiceGenerationFailed        = "ServiceGenerationFailed"
	WorkspaceConditionReasonVirtualServiceGenerationFailed = "VirtualServiceGenerationFailed"
	WorkspaceConditionReasonDuplicateResources             = "DuplicateResources"
	WorkspaceConditionReasonControllerReferenceFailed      = "ControllerReferenceFailed"

	// reasons for the PodScheduled condition
	WorkspaceConditionReasonScheduled       = "Scheduled"
	WorkspaceConditionReasonUnschedulable   = "Unschedulable"
	WorkspaceConditionReasonSchedulingGated = "SchedulingGated"
	WorkspaceConditionReasonSchedulerError  = "SchedulerError"

	// reasons for the WorkspaceReady condition
	WorkspaceConditionReasonRunning                 = "Running"
	WorkspaceConditionReasonPending                 = "Pending"
	WorkspaceConditionReasonCrashLoopBackOff        = "CrashLoopBackOff"
	WorkspaceConditionReasonImagePullBackOff        = "ImagePullBackOff"
	WorkspaceConditionReasonPodWarningEvent         = "PodWarningEvent"
	WorkspaceConditionReasonStatefulSetWarningEvent = "StatefulSetWarningEvent"
)

/*
===============================================================================
                                   Workspace
===============================================================================
*/

// +kubebuilder:object:root=true
// +kubebuilder:printcolumn:name="State",type="string",JSONPath=".status.state",description="The current state of the Workspace"
// +kubebuilder:subresource:status
// +kubebuilder:resource:shortName=ws

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
