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
	"k8s.io/apimachinery/pkg/types"
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
	// +optional
	// +default=false
	Paused bool `json:"paused"`

	// an optional human-readable name for the Workspace, displayed in the UI instead of metadata.name
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=128
	// +optional
	// +kubebuilder:example:="My Workspace"
	DisplayName *string `json:"displayName,omitempty"`

	// the WorkspaceKind to use
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="Workspace 'kind' is immutable"
	// +kubebuilder:example="jupyterlab"
	// +required
	Kind string `json:"kind"`

	// options for "podTemplate"-type WorkspaceKinds
	// +required
	PodTemplate WorkspacePodTemplate `json:"podTemplate"`
}

type WorkspacePodTemplate struct {
	// metadata to be applied to the Pod resource
	// +optional
	PodMetadata *WorkspacePodMetadata `json:"podMetadata,omitempty"`

	// volume configs
	// +required
	Volumes WorkspacePodVolumes `json:"volumes"`

	// the selected podTemplate options
	// +required
	Options WorkspacePodOptions `json:"options"`
}

type WorkspacePodMetadata struct {
	// labels to be applied to the Pod resource
	//  - entries are currently NOT allowed, until the security model
	//    for Workspace-level Pod metadata is defined
	// +optional
	// +kubebuilder:validation:MaxProperties:=0
	Labels map[string]string `json:"labels,omitempty"`

	// annotations to be applied to the Pod resource
	//  - entries are currently NOT allowed, until the security model
	//    for Workspace-level Pod metadata is defined
	// +optional
	// +kubebuilder:validation:MaxProperties:=0
	Annotations map[string]string `json:"annotations,omitempty"`
}

type WorkspacePodVolumes struct {
	// the name of the PVC to mount as the home volume
	//  - this PVC must already exist in the Namespace
	//  - this PVC must be RWX (ReadWriteMany, ReadWriteOnce)
	//  - the mount path is defined in the WorkspaceKind under
	//    `spec.podTemplate.volumeMountPaths.home`
	// +optional
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
	// +optional
	// +listType=map
	// +listMapKey=mountPath
	Data []PodVolumeMount `json:"data,omitempty"`

	// secrets to mount
	//  - these secrets must already exist in the Namespace
	//  - secrets are mounted as folders with the secret keys as files
	// +optional
	// +listType=map
	// +listMapKey=mountPath
	Secrets []PodSecretMount `json:"secrets,omitempty"`
}

type PodVolumeMount struct {
	// the name of the PVC to mount
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
	// +kubebuilder:example="my-data-pvc"
	// +required
	PVCName string `json:"pvcName"`

	// the mount path for the PVC
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=4096
	// +kubebuilder:validation:Pattern:=^/[^/].*$
	// +kubebuilder:example="/data/my-data"
	// +required
	MountPath string `json:"mountPath"`

	// if the PVC should be mounted as ReadOnly
	// +optional
	// +default=false
	ReadOnly *bool `json:"readOnly,omitempty"`
}

type PodSecretMount struct {
	// the name of the Secret to mount
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
	// +kubebuilder:example="my-secret"
	// +required
	SecretName string `json:"secretName"`

	// the mount path for the Secret
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=4096
	// +kubebuilder:validation:Pattern:=^/[^/].*$
	// +kubebuilder:example="/secrets/my-secret"
	// +required
	MountPath string `json:"mountPath"`

	// default mode bits used to set permissions on files in the Secret
	//  - must be a decimal value between 0 and 511, or an octal value between 0000 and 0777
	//  - for example, 420 is equivalent to 0644, and 511 is equivalent to 0777
	//  - YAML accepts both octal and decimal values, JSON requires decimal
	//  - Defaults to 420 (octal: 0644) if not specified.
	// +optional
	// +kubebuilder:validation:Minimum:=0
	// +kubebuilder:validation:Maximum:=511
	// +default=420
	DefaultMode *int32 `json:"defaultMode,omitempty"`
}

type WorkspacePodOptions struct {
	// the id of an imageConfig option
	//  - options are defined in WorkspaceKind under
	//    `spec.podTemplate.options.imageConfig.values[]`
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="jupyterlab_scipy_190"
	// +required
	ImageConfig string `json:"imageConfig"`

	// the id of a podConfig option
	//  - options are defined in WorkspaceKind under
	//    `spec.podTemplate.options.podConfig.values[]`
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="big_gpu"
	// +required
	PodConfig string `json:"podConfig"`
}

/*
===============================================================================
                              Workspace - Status
===============================================================================
*/

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	// activity information for the Workspace, used to determine activity rule actions
	// +required
	Activity WorkspaceActivity `json:"activity"`

	// the last time the Workspace entered a Running state (UNIX epoch in milliseconds)
	//  - used to compute running duration for `minRunningSeconds` activity guard
	//  - set to 0 when the Workspace has never been in a Running state
	// +default=0
	// +kubebuilder:example=1704060000000
	// +required
	LastRunningTime int64 `json:"lastRunningTime"`

	// the time when the Workspace was paused (UNIX epoch in milliseconds)
	//  - set to 0 when the Workspace is NOT paused
	// +default=0
	// +kubebuilder:example=1704067200000
	// +required
	PauseTime int64 `json:"pauseTime"`

	// if the current Pod does not reflect the current "desired" state
	//  - true if any `spec.podTemplate.options` have a redirect
	//    and so will be patched on the next restart
	//  - true if the WorkspaceKind has changed one of its common `podTemplate` fields
	//    like `podMetadata`, `podSpec.mainContainer.livenessProbe`,
	//    `podSpec.mainContainer.extraEnv`, or `podSpec.mainContainer.securityContext`
	// +default=false
	// +required
	PendingRestart bool `json:"pendingRestart"`

	// information about the current podTemplate options (only set for WorkspaceKind of podTemplate kind)
	// +required
	PodTemplateOptions WorkspacePodOptionsStatus `json:"podTemplateOptions"`

	// information about the Pod managed by this Workspace (only set for WorkspaceKind of podTemplate kind)
	// +required
	PodTemplatePod WorkspacePodStatus `json:"podTemplatePod"`

	// information about the StatefulSet managed by this Workspace (only set for WorkspaceKind of podTemplate kind)
	// +required
	PodTemplateStatefulSet WorkspaceStatefulSetStatus `json:"podTemplateStatefulSet"`

	// the current state of the Workspace
	// +default="Unknown"
	// +required
	State WorkspaceState `json:"state"`

	// a human-readable message about the state of the Workspace
	//  - WARNING: this field is NOT FOR MACHINE USE, subject to change without notice
	// +default=""
	// +required
	StateMessage string `json:"stateMessage"`
}

type WorkspaceActivity struct {
	// the last time activity was observed on the Workspace (UNIX epoch in milliseconds)
	//  - this is the value returned by the activity probe, not the time the probe was run
	//  - the activity probe is authoritative: on success, the probe result unconditionally
	//    overwrites this timestamp (the controller does not validate monotonicity or clamp to wall-clock time)
	//  - not updated when a probe fails
	// +default=0
	// +kubebuilder:example=1704067200000
	// +required
	LastActivity int64 `json:"lastActivity"`

	// the end time of the last successful probe (UNIX epoch in milliseconds)
	//  - not updated when a probe fails
	//  - used to determine when the next probe should run
	// +default=0
	// +kubebuilder:example=1704067200000
	// +required
	LastUpdate int64 `json:"lastUpdate"`

	// probe result tracking
	// +optional
	LastProbe *WorkspaceActivityLastProbe `json:"lastProbe,omitempty"`

	// rule evaluation state
	// +optional
	Rules *WorkspaceActivityRules `json:"rules,omitempty"`
}

// WorkspaceActivityLastProbe defines the result of the most recent activity probe execution
type WorkspaceActivityLastProbe struct {
	// the time the probe was started (UNIX epoch in milliseconds)
	// +kubebuilder:example=1710435303000
	// +required
	StartTime int64 `json:"startTime"`

	// the time the probe was completed (UNIX epoch in milliseconds)
	// +kubebuilder:example=1710435305000
	// +required
	EndTime int64 `json:"endTime"`

	// the result of the last probe execution
	// +required
	Result WorkspaceProbeResult `json:"result"`

	// a human-readable message about the probe result
	//  - WARNING: this field is NOT FOR MACHINE USE, subject to change without notice
	// +default=""
	// +kubebuilder:example="PodExec probe succeeded"
	// +required
	Message string `json:"message"`
}

// WorkspaceProbeResult defines the possible outcomes of an activity probe execution
//
// +kubebuilder:validation:Enum:={"Success","Failure","Timeout"}
type WorkspaceProbeResult string

const (
	WorkspaceProbeResultSuccess WorkspaceProbeResult = "Success"
	WorkspaceProbeResultFailure WorkspaceProbeResult = "Failure"
	WorkspaceProbeResultTimeout WorkspaceProbeResult = "Timeout"
)

// WorkspaceActivityRules defines the evaluation state for activity-based rules
type WorkspaceActivityRules struct {
	// rule evaluation state for the pauseWorkspace effect
	// +optional
	PauseWorkspace *WorkspaceActivityPauseRule `json:"pauseWorkspace,omitempty"`
}

// WorkspaceActivityPauseRule defines the evaluation state for the activity-based pauseWorkspace effect
type WorkspaceActivityPauseRule struct {
	// the time after which if the rule is evaluated the Workspace would be paused (UNIX epoch in milliseconds)
	//  - set to 0 when lastActivity is unknown (<= 0), indicating eligibility cannot be computed / not applicable
	//  - the controller will not pause a Workspace when eligibleAfter is 0
	// +default=0
	// +kubebuilder:example=1707667200000
	// +required
	EligibleAfter int64 `json:"eligibleAfter"`
}

type WorkspacePodOptionsStatus struct {
	// info about the current imageConfig option
	// +required
	ImageConfig WorkspacePodOptionInfo `json:"imageConfig"`

	// info about the current podConfig option
	// +required
	PodConfig WorkspacePodOptionInfo `json:"podConfig"`
}

type WorkspacePodOptionInfo struct {
	// the option id which will take effect after the next restart
	// +optional
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	Desired string `json:"desired,omitempty"`

	// the chain from the current option to the desired option
	// +optional
	RedirectChain []WorkspacePodOptionRedirectStep `json:"redirectChain,omitempty"`
}

type WorkspacePodOptionRedirectStep struct {
	// the source option id
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +required
	Source string `json:"source"`

	// the target option id
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +required
	Target string `json:"target"`
}

type WorkspacePodStatus struct {
	// the name of the Pod resource
	// +optional
	Name string `json:"name,omitempty"`

	// the UID of the Pod resource
	// +optional
	UID types.UID `json:"uid,omitempty"`

	// the name of the node on which the Pod is scheduled
	// +optional
	NodeName string `json:"nodeName,omitempty"`

	// the name of the ServiceAccount that the Pod runs as
	//  - this ServiceAccount is created and owned by the Workspace, and is stable for its lifetime
	//  - the name has a random suffix, so it is reported here for Roles, RoleBindings,
	//    and Istio AuthorizationPolicies which need to reference the ServiceAccount
	// +optional
	// +kubebuilder:example="ws-my-workspace-abcde"
	ServiceAccountName string `json:"serviceAccountName,omitempty"`

	// information about the Pod's containers
	// +optional
	Containers []WorkspacePodContainer `json:"containers,omitempty"`

	// information about the Pod's initContainers
	// +optional
	InitContainers []WorkspacePodContainer `json:"initContainers,omitempty"`
}

type WorkspacePodContainer struct {
	// the name of the container
	// +required
	Name string `json:"name"`
}

type WorkspaceStatefulSetStatus struct {
	// the name of the StatefulSet resource
	// +optional
	Name string `json:"name,omitempty"`

	// the UID of the StatefulSet resource
	// +optional
	UID types.UID `json:"uid,omitempty"`
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
// +kubebuilder:printcolumn:name="Kind",type="string",JSONPath=".spec.kind",description="The WorkspaceKind of the Workspace"
// +kubebuilder:printcolumn:name="Image Config",type="string",JSONPath=".spec.podTemplate.options.imageConfig",description="The imageConfig option of the Workspace"
// +kubebuilder:printcolumn:name="Pod Config",type="string",JSONPath=".spec.podTemplate.options.podConfig",description="The podConfig option of the Workspace"
// +kubebuilder:subresource:status
// +kubebuilder:resource:shortName=ws

// Workspace is the Schema for the Workspaces API
type Workspace struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// +optional
	Spec WorkspaceSpec `json:"spec,omitempty"`
	// +optional
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
