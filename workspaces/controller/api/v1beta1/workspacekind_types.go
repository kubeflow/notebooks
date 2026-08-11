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
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Important: Run "make" to regenerate code after modifying this file

// Default values for ActivityProbe fields. These MUST stay in sync with the
// corresponding +kubebuilder:default markers on the ActivityProbe types, so that
// the controller and the API server agree on the effective value when a field is unset.
const (
	// DefaultProbeIntervalSeconds is the fallback for ActivityProbe.ProbeIntervalSeconds.
	DefaultProbeIntervalSeconds int32 = 3600

	// DefaultMinProbeIntervalSeconds is the fallback for ActivityProbe.MinProbeIntervalSeconds.
	DefaultMinProbeIntervalSeconds int32 = 300

	// DefaultPodExecTimeoutSeconds is the fallback for ActivityProbePodExec.TimeoutSeconds.
	DefaultPodExecTimeoutSeconds int32 = 60
)

/*
===============================================================================
                             WorkspaceKind - Spec
===============================================================================
*/

// the id of a port
//
// +kubebuilder:validation:MinLength:=1
// +kubebuilder:validation:MaxLength:=32
// +kubebuilder:validation:Pattern:=^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$
type PortId string

// WorkspaceKindSpec defines the desired state of WorkspaceKind
type WorkspaceKindSpec struct {

	// spawner config determines how the WorkspaceKind is displayed in the Workspace Spawner UI
	Spawner WorkspaceKindSpawner `json:"spawner"`

	// podTemplate is the PodTemplate used to spawn Pods to run Workspaces of this WorkspaceKind
	PodTemplate WorkspaceKindPodTemplate `json:"podTemplate"`

	// activityRules defines the policies for handling inactivity in Workspaces of this WorkspaceKind (MUTABLE).
	// Rules are evaluated sequentially from top to bottom (first-match-wins semantics) independently for each
	// configured effect type (e.g., pauseWorkspace). A rule with a nil or empty 'match' is treated as a catch-all
	// rule; at most one catch-all rule is allowed per effect type, and it must be the last rule in the list.
	// +kubebuilder:validation:Optional
	// +listType:="atomic"
	ActivityRules []ActivityRule `json:"activityRules,omitempty"`

	// filterRules are admin-defined rules used by downstream consumers (the backend API server)
	// to dynamically filter which WorkspaceKinds, imageConfig values, and podConfig values are
	// visible or allowed in a given context. (MUTABLE)
	// The controller does NOT evaluate or act on these rules, it only persists and validates them.
	// +kubebuilder:validation:Optional
	// +listType:="atomic"
	FilterRules []FilterRule `json:"filterRules,omitempty"`
}

// ActivityRule defines a policy for handling inactivity in a Workspace
type ActivityRule struct {
	// the configuration for this rule
	Config ActivityRuleConfig `json:"config"`

	// the conditions under which this rule applies
	// +kubebuilder:validation:Optional
	Match *ActivityRuleMatch `json:"match,omitempty"`

	// the action to take when the rule matches and its conditions are met
	Effect ActivityRuleEffect `json:"effect"`
}

// ActivityRuleConfig defines the timing parameters for an ActivityRule
type ActivityRuleConfig struct {
	// the number of seconds of inactivity before a Workspace is eligible for this rule's effect
	//  - the minimum value is 16 (`secondsSinceActive` > 15) to prevent thrashing and culling
	//    workspaces prematurely during startup or transient connection drops
	// +kubebuilder:validation:Minimum:=16
	SecondsSinceActive int32 `json:"secondsSinceActive"`

	// the minimum duration in seconds a Workspace must be running before it can be paused due to inactivity
	// +kubebuilder:validation:Minimum:=0
	// +kubebuilder:default:=0
	// +kubebuilder:validation:Optional
	MinRunningSeconds *int32 `json:"minRunningSeconds,omitempty"`
}

// ActivityRuleMatch defines the conditions under which an ActivityRule applies.
// If both matchNamespace and matchPodConfig are specified, they are combined with AND semantics (both must match).
// If both are unspecified (or the Match block is omitted entirely), it acts as a catch-all rule that matches all Workspaces.
type ActivityRuleMatch struct {
	// filters Workspaces by namespace labels
	// +kubebuilder:validation:Optional
	MatchNamespace *NamespaceMatch `json:"matchNamespace,omitempty"`

	// filters Workspaces by the PodConfig option they are using
	// +kubebuilder:validation:Optional
	MatchPodConfig *PodConfigMatch `json:"matchPodConfig,omitempty"`
}

// NamespaceMatch filters Workspaces by namespace labels
type NamespaceMatch struct {
	// the standard Kubernetes label selector to match namespace labels
	Selector metav1.LabelSelector `json:"selector"`
}

// PodConfigMatch filters Workspaces by the PodConfig option they are using
type PodConfigMatch struct {
	// the standard Kubernetes label selector to match podConfig labels
	Selector metav1.LabelSelector `json:"selector"`
}

// ActivityRuleEffect defines the action to take when a rule matches.
//
// Each field is a tri-state (`*bool`) controlling one effect type:
//   - `true`: apply the effect (e.g., pause the Workspace)
//   - `false`: do not apply the effect (e.g., exempt matching Workspaces from being paused)
//   - `nil`: skip this effect type entirely; evaluation continues to subsequent rules
//
// Both `true` and `false` terminate evaluation for that effect type.
// Only `nil` causes fallthrough to the next rule.
//
// +kubebuilder:validation:XValidation:message="must specify at least one effect",rule="has(self.pauseWorkspace)"
type ActivityRuleEffect struct {
	// determines if the Workspace should be paused
	//  - the webhook rejects rules with `pauseWorkspace: true`
	//    when no `activityProbe` is configured
	// +kubebuilder:validation:Optional
	PauseWorkspace *bool `json:"pauseWorkspace,omitempty"`
}

type WorkspaceKindSpawner struct {
	// the display name of the WorkspaceKind
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=128
	// +kubebuilder:example:="JupyterLab Notebook"
	DisplayName string `json:"displayName"`

	// the description of the WorkspaceKind
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=4096
	// +kubebuilder:example:="A Workspace which runs JupyterLab in a Pod"
	Description string `json:"description"`

	// if this WorkspaceKind should be hidden from the Workspace Spawner UI
	// +kubebuilder:validation:Optional
	// +kubebuilder:default:=false
	Hidden *bool `json:"hidden,omitempty"`

	// if this WorkspaceKind is deprecated
	// +kubebuilder:validation:Optional
	// +kubebuilder:default:=false
	Deprecated *bool `json:"deprecated,omitempty"`

	// a message to show in Workspace Spawner UI when the WorkspaceKind is deprecated
	// +kubebuilder:validation:Optional
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example:="This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind."
	DeprecationMessage *string `json:"deprecationMessage,omitempty"`

	// the icon of the WorkspaceKind
	//  - a small (favicon-sized) icon used in the Workspace Spawner UI
	Icon WorkspaceKindAsset `json:"icon"`

	// the logo of the WorkspaceKind
	//  - a 1:1 (card size) logo used in the Workspace Spawner UI
	Logo WorkspaceKindAsset `json:"logo"`
}

// +kubebuilder:validation:XValidation:message="must specify exactly one of 'url' or 'configMap'",rule="!(has(self.url) && has(self.configMap)) && (has(self.url) || has(self.configMap))"
type WorkspaceKindAsset struct {
	// the URL of the asset
	// +kubebuilder:validation:Optional
	// +kubebuilder:example="https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png"
	Url *string `json:"url,omitempty"`

	// the ConfigMap reference for the asset
	// +kubebuilder:validation:Optional
	ConfigMap *WorkspaceKindAssetConfigMap `json:"configMap,omitempty"`
}

type WorkspaceKindAssetConfigMap struct {
	// the name of the ConfigMap
	// +kubebuilder:example="my-logos"
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
	Name string `json:"name"`

	// the namespace of the ConfigMap
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=63
	// +kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
	// +kubebuilder:example="kubeflow"
	Namespace string `json:"namespace"`

	// the key in the ConfigMap which contains the data
	// +kubebuilder:example="jupyterlab-logo.svg"
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=253
	// +kubebuilder:validation:Pattern:=^[-._a-zA-Z0-9]+$
	Key string `json:"key"`

	// the media type of the asset data in the ConfigMap
	// +kubebuilder:example="image/svg+xml"
	MediaType WorkspaceKindAssetMediaType `json:"mediaType"`
}

// +kubebuilder:validation:Enum:={"image/svg+xml"}
type WorkspaceKindAssetMediaType string

const (
	WorkspaceKindAssetMediaTypeSVG WorkspaceKindAssetMediaType = "image/svg+xml"
)

type WorkspaceKindPodTemplate struct {
	// metadata for Workspace Pods (MUTABLE)
	// +kubebuilder:validation:Optional
	PodMetadata *WorkspaceKindPodMetadata `json:"podMetadata,omitempty"`

	// service account configs for Workspace Pods
	//  - currently has no fields, the ServiceAccount used by Workspace Pods is
	//    hardcoded to "default-editor" in the controller
	//  - this ServiceAccount MUST already exist in the Namespace of the Workspace,
	//    the controller will NOT create it
	// +kubebuilder:validation:Optional
	ServiceAccount *WorkspaceKindServiceAccount `json:"serviceAccount,omitempty"`

	// activityProbe configs to determine Workspace activity (MUTABLE)
	// +kubebuilder:validation:Optional
	ActivityProbe *ActivityProbe `json:"activityProbe,omitempty"`

	// standard probes to determine Container health (MUTABLE)
	// +kubebuilder:validation:Optional
	Probes *WorkspaceKindProbes `json:"probes,omitempty"`

	// volume mount paths
	VolumeMounts WorkspaceKindVolumeMounts `json:"volumeMounts"`

	// port definitions which can be referenced in image config values
	// - think of port definitions as the "types" of services which could be provided by a specific image
	// - a port definition has a common id (URL path) for consistency if the listening TCP port changes
	// - ports are referenced in image config values by their `id` and their definition here establishes
	//   their protocol type, and default display name in the UI
	// +kubebuilder:validation:MinItems:=1
	// +listType:="map"
	// +listMapKey:="id"
	Ports []WorkspaceKindPort `json:"ports"`

	// environment variables for Workspace Pods (MUTABLE)
	//  - the following go template functions are available:
	//     - `httpPathPrefix(portId string)`: returns the HTTP path prefix of the specified port
	// +kubebuilder:validation:Optional
	// +kubebuilder:example:={ "NB_PREFIX": "{{ httpPathPrefix 'jupyterlab' }}" }
	// +listType:="map"
	// +listMapKey:="name"
	ExtraEnv []v1.EnvVar `json:"extraEnv,omitempty"`

	// extra volume mounts for Workspace Pods (MUTABLE)
	// +kubebuilder:validation:Optional
	// +listType:="map"
	// +listMapKey:="mountPath"
	ExtraVolumeMounts []v1.VolumeMount `json:"extraVolumeMounts,omitempty"`

	// extra volumes for Workspace Pods (MUTABLE)
	// +kubebuilder:validation:Optional
	// +listType:="map"
	// +listMapKey:="name"
	ExtraVolumes []v1.Volume `json:"extraVolumes,omitempty"`

	// security context for Workspace Pods (MUTABLE)
	// +kubebuilder:validation:Optional
	SecurityContext *v1.PodSecurityContext `json:"securityContext,omitempty"`

	// container security context for Workspace Pods (MUTABLE)
	// +kubebuilder:validation:Optional
	ContainerSecurityContext *v1.SecurityContext `json:"containerSecurityContext,omitempty"`

	// options are the user-selectable fields, they determine the PodSpec of the Workspace
	Options WorkspaceKindPodOptions `json:"options"`
}

type WorkspaceKindPort struct {
	// the id of the port
	// - identifier for the port in `imageconfig` ports.[].id
	// +kubebuilder:example="jupyterlab"
	Id PortId `json:"id"`

	// the protocol of the port
	// +kubebuilder:example:="HTTP"
	Protocol ImagePortProtocol `json:"protocol"`

	// the default display name of the port
	// - note, this can be overridden on a per image config value basis
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=64
	// +kubebuilder:example:="JupyterLab"
	DefaultDisplayName string `json:"defaultDisplayName"`

	// the http proxy config for the port (MUTABLE)
	// +kubebuilder:validation:Optional
	HTTPProxy *HTTPProxy `json:"httpProxy,omitempty"`
}

type WorkspaceKindPodMetadata struct {
	// labels to be applied to the Pod resource
	// +kubebuilder:validation:Optional
	Labels map[string]string `json:"labels,omitempty"`

	// annotations to be applied to the Pod resource
	// +kubebuilder:validation:Optional
	Annotations map[string]string `json:"annotations,omitempty"`
}

// WorkspaceKindServiceAccount is currently empty, fields will be added once
// Workspaces get their own controller-managed ServiceAccounts.
// See https://github.com/kubeflow/notebooks/issues/1257
type WorkspaceKindServiceAccount struct {
}

// ActivityProbe defines how to detect recent user activity in a Workspace
//
// +kubebuilder:validation:XValidation:message="must specify exactly one of 'podExec' or 'jupyter'",rule="!(has(self.podExec) && has(self.jupyter)) && (has(self.podExec) || has(self.jupyter))"
// +kubebuilder:validation:XValidation:message="minProbeIntervalSeconds must be less than or equal to probeIntervalSeconds",rule="self.minProbeIntervalSeconds <= self.probeIntervalSeconds"
type ActivityProbe struct {
	// the minimum duration in seconds that must elapse between two consecutive probes.
	// - Acts as a rate-limiter for failed probes: if a probe fails, the controller waits at least this long before retrying (requeuing after minProbeInterval).
	// - Also acts as a guard: if a reconcile triggers early, the probe is skipped until this interval has elapsed since the last probe.
	// +kubebuilder:validation:Minimum:=1
	// +kubebuilder:validation:Maximum:=31536000
	// +kubebuilder:default:=300
	// +kubebuilder:validation:Optional
	MinProbeIntervalSeconds *int32 `json:"minProbeIntervalSeconds,omitempty"`

	// the desired interval in seconds between successful probes.
	// - If a probe succeeds, the controller schedules the next probe after this duration (requeuing after probeInterval).
	// - Determines the freshness of workspace activity status used for culling inactive workspaces.
	// +kubebuilder:validation:Minimum:=1
	// +kubebuilder:validation:Maximum:=31536000
	// +kubebuilder:default:=3600
	// +kubebuilder:validation:Optional
	ProbeIntervalSeconds *int32 `json:"probeIntervalSeconds,omitempty"`

	// a script-based probe executed in the Pod
	// +kubebuilder:validation:Optional
	PodExec *ActivityProbePodExec `json:"podExec,omitempty"`

	// a Jupyter-specific API probe
	// +kubebuilder:validation:Optional
	Jupyter *ActivityProbeJupyter `json:"jupyter,omitempty"`
}

// ActivityProbePodExec defines a script-based activity probe executed via the Kubernetes exec API
type ActivityProbePodExec struct {
	// the maximum number of seconds the probe is allowed to run
	// +kubebuilder:validation:Minimum:=1
	// +kubebuilder:default:=60
	// +kubebuilder:validation:Optional
	TimeoutSeconds *int32 `json:"timeoutSeconds,omitempty"`

	// script is the script to run inside the Pod to determine if the Workspace is active.
	// The script must meet the following requirements:
	//  - It must start with a shebang (e.g., "#!/usr/bin/env bash" or "#!/usr/bin/env python").
	//  - It must exit with a 0 status code. A non-zero exit code is treated as a probe failure (Workspaces with failing probes are not culled).
	//  - It should be idempotent and without side effects since it can be run multiple times.
	//  - If the script wants to report an INACTIVE state, it MUST write a JSON object to the file path
	//    supplied in the OUTPUT_JSON_PATH environment variable. The fields are evaluated to update the
	//    Workspace status field `status.activity.lastActivity` as follows:
	//      - If `has_activity` is explicitly set to `true` (or if the JSON file is empty/omitted): The Workspace is treated as active, and `status.activity.lastActivity` is updated to the probe completion time (ignoring `last_activity`).
	//      - If `last_activity` (ISO 8601 string) is provided and `has_activity` is explicitly `false` (or omitted): The Workspace is treated as inactive, and `status.activity.lastActivity` is updated to the `last_activity` timestamp.
	//      - If `has_activity` is explicitly `false` and `last_activity` is omitted: The Workspace is treated as inactive, and the existing `status.activity.lastActivity` timestamp is preserved (unchanged).
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=2048
	Script string `json:"script"`
}

// ActivityProbeJupyter defines a Jupyter-specific probe that polls the /api/status endpoint
//
// +kubebuilder:validation:XValidation:message="'lastActivity' must be true",rule="has(self.lastActivity) && self.lastActivity"
type ActivityProbeJupyter struct {
	// if the Jupyter-specific probe is enabled
	// +kubebuilder:example=true
	LastActivity bool `json:"lastActivity"`

	// the port to probe, referencing a port defined in spec.podTemplate.ports
	PortId PortId `json:"portId"`
}

type WorkspaceKindProbes struct {
	// the startup probe for the main container
	// +kubebuilder:validation:Optional
	StartupProbe *v1.Probe `json:"startupProbe,omitempty"`

	// the liveness probe for the main container
	// +kubebuilder:validation:Optional
	LivenessProbe *v1.Probe `json:"livenessProbe,omitempty"`

	// the readiness probe for the main container
	// +kubebuilder:validation:Optional
	ReadinessProbe *v1.Probe `json:"readinessProbe,omitempty"`
}

type WorkspaceKindVolumeMounts struct {
	// the path to mount the home PVC (NOT MUTABLE)
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=4096
	// +kubebuilder:validation:Pattern:=^/[^/].*$
	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="mount path of 'home' is immutable"
	// +kubebuilder:example:="/home/jovyan"
	Home string `json:"home"`
}

type HTTPProxy struct {
	// if the path prefix is stripped from incoming HTTP requests
	//  - if true, the '/workspace/connect/{profile_name}/{workspace_name}/' path prefix
	//    is stripped from incoming requests, the application sees the request
	//    as if it was made to '/...'
	//  - this only works if the application serves RELATIVE URLs for its assets
	// +kubebuilder:validation:Optional
	// +kubebuilder:default:=false
	RemovePathPrefix *bool `json:"removePathPrefix,omitempty"`

	// header manipulation rules for incoming HTTP requests
	//  - sets the `spec.http[].headers.request` of the Istio VirtualService
	//    https://istio.io/latest/docs/reference/config/networking/virtual-service/#Headers-HeaderOperations
	// +kubebuilder:validation:Optional
	RequestHeaders *IstioHeaderOperations `json:"requestHeaders,omitempty"`
}

type IstioHeaderOperations struct {
	// overwrite the headers specified by key with the given values
	//  - the following go template functions are available in the values:
	//     - `httpPathPrefix(portId string)`: returns the HTTP path prefix of the specified port
	// +kubebuilder:validation:Optional
	// +kubebuilder:example:={ "X-RStudio-Root-Path": "{{ httpPathPrefix 'rstudio' }}" }
	Set map[string]string `json:"set,omitempty"`

	// append the given values to the headers specified by keys (will create a comma-separated list of values)
	//  - the following go template functions are available in the values:
	//     - `httpPathPrefix(portId string)`: returns the HTTP path prefix of the specified port
	// +kubebuilder:validation:Optional
	// +kubebuilder:example:={ "My-Header": "value-to-append" }
	Add map[string]string `json:"add,omitempty"`

	// remove the specified headers
	// +kubebuilder:validation:Optional
	// +kubebuilder:example:={"Header-To-Remove"}
	Remove []string `json:"remove,omitempty"`
}

type WorkspaceKindPodOptions struct {
	// imageConfig options
	ImageConfig ImageConfig `json:"imageConfig"`

	// podConfig options
	PodConfig PodConfig `json:"podConfig"`
}

type ImageConfig struct {
	// spawner ui configs
	Spawner OptionsSpawnerConfig `json:"spawner"`

	// the list of image configs that are available
	// +kubebuilder:validation:MinItems:=1
	// +listType:="map"
	// +listMapKey:="id"
	Values []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	// the id of this image config
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example:="jupyterlab_scipy_190"
	Id string `json:"id"`

	// information for the spawner ui
	Spawner OptionSpawnerInfo `json:"spawner"`

	// redirect configs
	// +kubebuilder:validation:Optional
	Redirect *OptionRedirect `json:"redirect,omitempty"`

	// the spec of the image config
	Spec ImageConfigSpec `json:"spec"`
}

type ImageConfigSpec struct {
	// the container image to use
	// +kubebuilder:validation:MinLength:=2
	// +kubeflow:example="ghcr.io/kubeflow/kubeflow/notebook-servers/jupyter-scipy:v1.7.0"
	Image string `json:"image"`

	// the pull policy for the container image
	// +kubebuilder:validation:Optional
	// +kubebuilder:default:="IfNotPresent"
	// +kubebuilder:validation:Enum:={"Always","IfNotPresent","Never"}
	ImagePullPolicy *v1.PullPolicy `json:"imagePullPolicy"`

	// ports that the container listens on
	//   - if multiple ports are defined, the user will see multiple "Connect" buttons
	//     in a dropdown menu on the Workspace overview page
	// +kubebuilder:validation:MinItems:=1
	// +listType:="map"
	// +listMapKey:="id"
	Ports []ImagePort `json:"ports"`
}

type ImagePort struct {
	// the id of the port
	//  - this is NOT used as the Container or Service port name, but as part of the HTTP path
	// +kubebuilder:example="jupyterlab"
	Id PortId `json:"id"`

	// the port number
	// +kubebuilder:validation:Minimum:=1
	// +kubebuilder:validation:Maximum:=65535
	// +kubebuilder:example:=8888
	Port int32 `json:"port"`

	// the display name of the port
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=64
	// +kubebuilder:validation:Optional
	DisplayName *string `json:"displayName,omitempty"`
}

// +kubebuilder:validation:Enum:={"HTTP"}
type ImagePortProtocol string

const (
	ImagePortProtocolHTTP ImagePortProtocol = "HTTP"
)

type PodConfig struct {
	// spawner ui configs
	Spawner OptionsSpawnerConfig `json:"spawner"`

	// the list of pod configs that are available
	// +kubebuilder:validation:MinItems:=1
	// +listType:="map"
	// +listMapKey:="id"
	Values []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	// the id of this pod config
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="big_gpu"
	Id string `json:"id"`

	// information for the spawner ui
	Spawner OptionSpawnerInfo `json:"spawner"`

	// redirect configs
	// +kubebuilder:validation:Optional
	Redirect *OptionRedirect `json:"redirect,omitempty"`

	// the spec of the pod config
	Spec PodConfigSpec `json:"spec"`
}

type PodConfigSpec struct {
	// affinity configs for the pod
	// +kubebuilder:validation:Optional
	Affinity *v1.Affinity `json:"affinity,omitempty"`

	// node selector configs for the pod
	// +kubebuilder:validation:Optional
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`

	// toleration configs for the pod
	// +kubebuilder:validation:Optional
	Tolerations []v1.Toleration `json:"tolerations,omitempty"`

	// resource configs for the "main" container in the pod
	// +kubebuilder:validation:Optional
	Resources *v1.ResourceRequirements `json:"resources,omitempty"`
}

type OptionsSpawnerConfig struct {
	// the id of the default option
	//  - this will be selected by default in the spawner ui
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="jupyterlab_scipy_190"
	Default string `json:"default"`
}

type OptionSpawnerInfo struct {
	// the display name of the option
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=128
	DisplayName string `json:"displayName"`

	// a description of the option
	// +kubebuilder:validation:Optional
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=1024
	Description *string `json:"description,omitempty"`

	// labels for the option
	// +kubebuilder:validation:Optional
	// +kubebuilder:validation:MaxItems:=32
	// +listType:="map"
	// +listMapKey:="key"
	Labels []OptionSpawnerLabel `json:"labels,omitempty"`

	// if this option should be hidden from the Workspace Spawner UI
	// +kubebuilder:validation:Optional
	// +kubebuilder:default:=false
	Hidden *bool `json:"hidden,omitempty"`
}

type OptionSpawnerLabel struct {
	// the key of the label
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=64
	Key string `json:"key"`

	// the value of the label
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=64
	Value string `json:"value"`
}

type OptionRedirect struct {
	// the id of the option to redirect to
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example:="jupyterlab_scipy_190"
	To string `json:"to"`

	// information about the redirect
	// +kubebuilder:validation:Optional
	Message *RedirectMessage `json:"message,omitempty"`
}

type RedirectMessage struct {
	// the importance level of the message
	// +kubebuilder:example:="Info"
	Level RedirectMessageLevel `json:"level"`

	// the text of the message to show
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=1024
	// +kubebuilder:example:="This update will increase the version of JupyterLab to v1.7.1"
	Text string `json:"text"`
}

// +kubebuilder:validation:Enum:={"Info","Warning","Danger"}
type RedirectMessageLevel string

const (
	RedirectMessageLevelInfo    RedirectMessageLevel = "Info"
	RedirectMessageLevelWarning RedirectMessageLevel = "Warning"
	RedirectMessageLevelDanger  RedirectMessageLevel = "Danger"
)

/*
===============================================================================
                          WorkspaceKind - Filter Rules
===============================================================================
*/

// FilterRule is a single admin-defined rule which applies an effect to matched
// items (WorkspaceKinds, imageConfig values, or podConfig values) when all of
// its match conditions are satisfied.
type FilterRule struct {
	// the type of resource whose visibility this rule controls
	Scope FilterRuleScope `json:"scope"`

	// the effect to apply to matched items when all `match` conditions are satisfied
	Effect FilterRuleEffect `json:"effect"`

	// the conditions which must ALL be satisfied for the rule to apply
	// +kubebuilder:validation:MinItems:=1
	// +listType:="atomic"
	Match []FilterRuleMatch `json:"match"`
}

// FilterRuleScope defines the type of resource whose visibility a filter rule controls
//
// +kubebuilder:validation:Enum:={"WORKSPACE_KIND","POD_CONFIG","IMAGE_CONFIG"}
type FilterRuleScope string

const (
	// FilterRuleScopeWorkspaceKind rules control the visibility of the WorkspaceKind itself
	FilterRuleScopeWorkspaceKind FilterRuleScope = "WORKSPACE_KIND"

	// FilterRuleScopePodConfig rules control the visibility of individual podConfig values
	FilterRuleScopePodConfig FilterRuleScope = "POD_CONFIG"

	// FilterRuleScopeImageConfig rules control the visibility of individual imageConfig values
	FilterRuleScopeImageConfig FilterRuleScope = "IMAGE_CONFIG"
)

// FilterRuleEffect defines the effect to apply when a filter rule matches
//
// +kubebuilder:validation:XValidation:message="must specify at least one of 'ui' or 'api'",rule="has(self.ui) || has(self.api)"
type FilterRuleEffect struct {
	// rendering hints for the frontend (the item is still returned by the API)
	// +kubebuilder:validation:Optional
	UI *FilterRuleEffectUI `json:"ui,omitempty"`

	// server-enforced behavior evaluated by the backend API server
	// +kubebuilder:validation:Optional
	API *FilterRuleEffectAPI `json:"api,omitempty"`
}

// FilterRuleEffectUI defines frontend rendering hints for a matched filter rule item
type FilterRuleEffectUI struct {
	// suggest the UI hide the matched item
	Hide bool `json:"hide"`
}

// FilterRuleEffectAPI defines server-enforced behavior for a matched filter rule item
//
// +kubebuilder:validation:XValidation:message="'denyMessage' may only be set when 'deny' is true",rule="!has(self.denyMessage) || (has(self.deny) && self.deny)"
type FilterRuleEffectAPI struct {
	// omit the matched item from the API response entirely
	// +kubebuilder:validation:Optional
	Hide *bool `json:"hide,omitempty"`

	// return the matched item but reject any workspace create/update which selects it
	// +kubebuilder:validation:Optional
	Deny *bool `json:"deny,omitempty"`

	// a message explaining why the matched item is denied
	// +kubebuilder:validation:Optional
	DenyMessage *FilterRuleDenyMessage `json:"denyMessage,omitempty"`
}

// FilterRuleDenyMessage defines the message shown when a filter rule denies a matched item
type FilterRuleDenyMessage struct {
	// the text of the message to show when the item is denied
	// +kubebuilder:validation:MinLength:=2
	// +kubebuilder:validation:MaxLength:=1024
	Text string `json:"text"`
}

// FilterRuleMatch defines a single match condition for a filter rule
//
// +kubebuilder:validation:XValidation:message="must specify exactly one of 'matchNamespace', 'matchImageConfig', or 'matchPodConfig'",rule="(has(self.matchNamespace) ? 1 : 0) + (has(self.matchImageConfig) ? 1 : 0) + (has(self.matchPodConfig) ? 1 : 0) == 1"
type FilterRuleMatch struct {
	// match against the labels of the namespace the workspace would be created in
	// +kubebuilder:validation:Optional
	MatchNamespace *FilterRuleSelector `json:"matchNamespace,omitempty"`

	// match against the `spawner.labels` of an imageConfig value
	// +kubebuilder:validation:Optional
	MatchImageConfig *FilterRuleSelector `json:"matchImageConfig,omitempty"`

	// match against the `spawner.labels` of a podConfig value
	// +kubebuilder:validation:Optional
	MatchPodConfig *FilterRuleSelector `json:"matchPodConfig,omitempty"`
}

// FilterRuleSelector wraps a standard Kubernetes label selector for use in filter rule match conditions
type FilterRuleSelector struct {
	// a standard Kubernetes label selector
	Selector metav1.LabelSelector `json:"selector"`
}

/*
===============================================================================
                            WorkspaceKind - Status
===============================================================================
*/

// WorkspaceKindStatus defines the observed state of WorkspaceKind
type WorkspaceKindStatus struct {

	// the number of Workspaces that are using this WorkspaceKind
	// +kubebuilder:default=0
	Workspaces int32 `json:"workspaces"`

	// metrics for podTemplate options
	PodTemplateOptions PodTemplateOptionsMetrics `json:"podTemplateOptions"`

	// status of the spawner icon
	SpawnerIcon ImageAssetStatus `json:"spawnerIcon"`

	// status of the spawner logo
	SpawnerLogo ImageAssetStatus `json:"spawnerLogo"`
}

type ImageAssetStatus struct {
	// sha256 hash of image asset content
	// +kubebuilder:validation:Optional
	Sha256 string `json:"sha256,omitempty"`

	// status of the configMap reference
	// +kubebuilder:validation:Optional
	ConfigMap *WorkspaceKindAssetConfigMapStatus `json:"configMap,omitempty"`
}

type WorkspaceKindAssetConfigMapStatus struct {
	// cause of the error when reading the configMap
	// +kubebuilder:validation:Optional
	Error *ConfigMapError `json:"errorType,omitempty"`

	// error message when reading the configMap
	// +kubebuilder:validation:Optional
	ErrorMessage *string `json:"errorMessage,omitempty"`
}

// +kubebuilder:validation:Enum:={"NotFound","KeyNotFound","Other"}
type ConfigMapError string

const (
	ConfigMapErrorNotFound    ConfigMapError = "NotFound"
	ConfigMapErrorKeyNotFound ConfigMapError = "KeyNotFound"
	ConfigMapErrorOther       ConfigMapError = "Other"
)

type PodTemplateOptionsMetrics struct {
	// metrics about the imageConfig options
	// +listType:="map"
	// +listMapKey:="id"
	ImageConfig []OptionMetric `json:"imageConfig"`

	// metrics about the podConfig options
	// +listType:="map"
	// +listMapKey:="id"
	PodConfig []OptionMetric `json:"podConfig"`
}

type OptionMetric struct {
	// the id of the option
	// +kubebuilder:validation:MinLength:=1
	// +kubebuilder:validation:MaxLength:=256
	// +kubebuilder:example="big_gpu"
	Id string `json:"id"`

	// the number of Workspaces currently using the option
	// +kubebuilder:example=3
	Workspaces int32 `json:"workspaces"`
}

/*
===============================================================================
                                 WorkspaceKind
===============================================================================
*/

// +kubebuilder:object:root=true
// +kubebuilder:printcolumn:name="Workspaces",type="integer",JSONPath=".status.workspaces",description="The number of Workspaces using this WorkspaceKind"
// +kubebuilder:printcolumn:name="Deprecated",type="boolean",JSONPath=".spec.spawner.deprecated",description="If this WorkspaceKind is deprecated"
// +kubebuilder:printcolumn:name="Hidden",type="boolean",JSONPath=".spec.spawner.hidden",description="If this WorkspaceKind is hidden from the spawner UI"
// +kubebuilder:subresource:status
// +kubebuilder:resource:scope=Cluster,shortName=wsk

// WorkspaceKind is the Schema for the WorkspaceKinds API
type WorkspaceKind struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WorkspaceKindSpec   `json:"spec,omitempty"`
	Status WorkspaceKindStatus `json:"status,omitempty"`
}

/*
===============================================================================
                               WorkspaceKindList
===============================================================================
*/

// +kubebuilder:object:root=true

// WorkspaceKindList contains a list of WorkspaceKind
type WorkspaceKindList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []WorkspaceKind `json:"items"`
}

func init() {
	SchemeBuilder.Register(&WorkspaceKind{}, &WorkspaceKindList{})
}
