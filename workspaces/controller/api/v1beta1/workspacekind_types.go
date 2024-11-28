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

/*
===============================================================================
                             WorkspaceKind - Spec
===============================================================================
*/

// WorkspaceKindSpec defines the desired state of WorkspaceKind
type WorkspaceKindSpec struct {

	// spawner config determines how the WorkspaceKind is displayed in the Workspace Spawner UI
	Spawner WorkspaceKindSpawner `json:"spawner"`

	// podTemplate is the PodTemplate used to spawn Pods to run Workspaces of this WorkspaceKind
	PodTemplate WorkspaceKindPodTemplate `json:"podTemplate"`
}

type WorkspaceKindSpawner struct {
	// the display name of the WorkspaceKind
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=128
	//+kubebuilder:example:="JupyterLab Notebook"
	DisplayName string `json:"displayName"`

	// the description of the WorkspaceKind
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=4096
	//+kubebuilder:example:="A Workspace which runs JupyterLab in a Pod"
	Description string `json:"description"`

	// if this WorkspaceKind should be hidden from the Workspace Spawner UI
	//+kubebuilder:validation:Optional
	//+kubebuilder:default:=false
	Hidden *bool `json:"hidden,omitempty"`

	// if this WorkspaceKind is deprecated
	//+kubebuilder:validation:Optional
	//+kubebuilder:default:=false
	Deprecated *bool `json:"deprecated,omitempty"`

	// a message to show in Workspace Spawner UI when the WorkspaceKind is deprecated
	//+kubebuilder:validation:Optional
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=256
	//+kubebuilder:example:="This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind."
	DeprecationMessage *string `json:"deprecationMessage,omitempty"`

	// the icon of the WorkspaceKind
	//  - a small (favicon-sized) icon used in the Workspace Spawner UI
	Icon WorkspaceKindIcon `json:"icon"`

	// the logo of the WorkspaceKind
	//  - a 1:1 (card size) logo used in the Workspace Spawner UI
	Logo WorkspaceKindIcon `json:"logo"`
}

// +kubebuilder:validation:XValidation:message="must specify exactly one of 'url' or 'configMap'",rule="!(has(self.url) && has(self.configMap)) && (has(self.url) || has(self.configMap))"
type WorkspaceKindIcon struct {
	//+kubebuilder:validation:Optional
	//+kubebuilder:example="https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png"
	Url *string `json:"url,omitempty"`

	//+kubebuilder:validation:Optional
	ConfigMap *WorkspaceKindConfigMap `json:"configMap,omitempty"`
}

type WorkspaceKindConfigMap struct {

	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=253
	//+kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$
	//+kubebuilder:example="my-logos"
	Name string `json:"name"`

	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=63
	//+kubebuilder:validation:Pattern:=^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
	Namespace string `json:"namespace"`

	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=253
	//+kubebuilder:validation:Pattern:=^[-._a-zA-Z0-9]+$
	//+kubebuilder:example="apple-touch-icon-152x152.png"
	Key string `json:"key"`
}

type WorkspaceKindPodTemplate struct {
	// metadata for Workspace Pods (MUTABLE)
	//+kubebuilder:validation:Optional
	PodMetadata *WorkspaceKindPodMetadata `json:"podMetadata,omitempty"`

	// service account configs for Workspace Pods
	ServiceAccount WorkspaceKindServiceAccount `json:"serviceAccount"`

	// culling configs for pausing inactive Workspaces (MUTABLE)
	//+kubebuilder:validation:Optional
	Culling *WorkspaceKindCullingConfig `json:"culling,omitempty"`

	// standard probes to determine Container health (MUTABLE)
	//+kubebuilder:validation:Optional
	Probes *WorkspaceKindProbes `json:"probes,omitempty"`

	// volume mount paths
	VolumeMounts WorkspaceKindVolumeMounts `json:"volumeMounts"`

	// http proxy configs (MUTABLE)
	//+kubebuilder:validation:Optional
	HTTPProxy *HTTPProxy `json:"httpProxy,omitempty"`

	// environment variables for Workspace Pods (MUTABLE)
	//  - the following go template functions are available:
	//     - `httpPathPrefix(portId string)`: returns the HTTP path prefix of the specified port
	//+kubebuilder:validation:Optional
	//+listType:="map"
	//+listMapKey:="name"
	ExtraEnv []v1.EnvVar `json:"extraEnv,omitempty"`

	// extra volume mounts for Workspace Pods (MUTABLE)
	//+kubebuilder:validation:Optional
	//+listType:="map"
	//+listMapKey:="mountPath"
	ExtraVolumeMounts []v1.VolumeMount `json:"extraVolumeMounts,omitempty"`

	// extra volumes for Workspace Pods (MUTABLE)
	//+kubebuilder:validation:Optional
	//+listType:="map"
	//+listMapKey:="name"
	ExtraVolumes []v1.Volume `json:"extraVolumes,omitempty"`

	// security context for Workspace Pods (MUTABLE)
	//+kubebuilder:validation:Optional
	SecurityContext *v1.PodSecurityContext `json:"securityContext,omitempty"`

	// container security context for Workspace Pods (MUTABLE)
	//+kubebuilder:validation:Optional
	ContainerSecurityContext *v1.SecurityContext `json:"containerSecurityContext,omitempty"`

	// options are the user-selectable fields, they determine the PodSpec of the Workspace
	Options WorkspaceKindPodOptions `json:"options"`
}

type WorkspaceKindPodMetadata struct {
	// labels to be applied to the Pod resource
	//+kubebuilder:validation:Optional
	Labels map[string]string `json:"labels,omitempty"`

	// annotations to be applied to the Pod resource
	//+kubebuilder:validation:Optional
	Annotations map[string]string `json:"annotations,omitempty"`
}

type WorkspaceKindServiceAccount struct {
	// the name of the ServiceAccount (NOT MUTABLE)
	//  - this Service Account MUST already exist in the Namespace
	//    of the Workspace, the controller will NOT create it
	//  - we will not show this WorkspaceKind in the Spawner UI
	//    if the SA does not exist in the Namespace
	//+kubebuilder:validation:XValidation:rule="self == oldSelf",message="ServiceAccount 'name' is immutable"
	//+kubebuilder:example="default-editor"
	Name string `json:"name"`
}

type WorkspaceKindCullingConfig struct {
	// if the culling feature is enabled
	//+kubebuilder:validation:Optional
	//+kubebuilder:default=true
	Enabled *bool `json:"enabled,omitempty"`

	// the maximum number of seconds a Workspace can be inactive
	//+kubebuilder:validation:Optional
	//+kubebuilder:validation:Minimum:=60
	//+kubebuilder:default=86400
	MaxInactiveSeconds *int32 `json:"maxInactiveSeconds,omitempty"`

	// the probe used to determine if the Workspace is active
	ActivityProbe ActivityProbe `json:"activityProbe"`
}

// +kubebuilder:validation:XValidation:message="must specify exactly one of 'exec' or 'jupyter'",rule="!(has(self.exec) && has(self.jupyter)) && (has(self.exec) || has(self.jupyter))"
type ActivityProbe struct {
	// a shell command probe
	//  - if the Workspace had activity in the last 60 seconds this command
	//    should return status 0, otherwise it should return status 1
	//+kubebuilder:validation:Optional
	Exec *ActivityProbeExec `json:"exec,omitempty"`

	// a Jupyter-specific probe
	//  - will poll the `/api/status` endpoint of the Jupyter API, and use the `last_activity` field
	//  - note, users need to be careful that their other probes don't trigger a "last_activity" update
	//    e.g. they should only check the health of Jupyter using the `/api/status` endpoint
	//+kubebuilder:validation:Optional
	Jupyter *ActivityProbeJupyter `json:"jupyter,omitempty"`
}

type ActivityProbeExec struct {
	// the command to run
	//+kubebuilder:validation:MinItems:=1
	//+kubebuilder:example={"bash", "-c", "exit 0"}
	Command []string `json:"command"`
}

// +kubebuilder:validation:XValidation:message="'lastActivity' must be true",rule="has(self.lastActivity) && self.lastActivity"
type ActivityProbeJupyter struct {
	// if the Jupyter-specific probe is enabled
	//+kubebuilder:example=true
	LastActivity bool `json:"lastActivity"`
}

type WorkspaceKindProbes struct {
	// the startup probe for the main container
	//+kubebuilder:validation:Optional
	StartupProbe *v1.Probe `json:"startupProbe,omitempty"`

	// the liveness probe for the main container
	//+kubebuilder:validation:Optional
	LivenessProbe *v1.Probe `json:"livenessProbe,omitempty"`

	// the readiness probe for the main container
	//+kubebuilder:validation:Optional
	ReadinessProbe *v1.Probe `json:"readinessProbe,omitempty"`
}

type WorkspaceKindVolumeMounts struct {
	// the path to mount the home PVC (NOT MUTABLE)
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=4096
	//+kubebuilder:validation:Pattern:=^/[^/].*$
	//+kubebuilder:validation:XValidation:rule="self == oldSelf",message="mount path of 'home' is immutable"
	//+kubebuilder:example:="/home/jovyan"
	Home string `json:"home"`
}

type HTTPProxy struct {
	// if the path prefix is stripped from incoming HTTP requests
	//  - if true, the '/workspace/{profile_name}/{workspace_name}/' path prefix
	//    is stripped from incoming requests, the application sees the request
	//    as if it was made to '/...'
	//  - this only works if the application serves RELATIVE URLs for its assets
	//+kubebuilder:validation:Optional
	//+kubebuilder:default:=false
	RemovePathPrefix *bool `json:"removePathPrefix,omitempty"`

	// header manipulation rules for incoming HTTP requests
	//  - sets the `spec.http[].headers.request` of the Istio VirtualService
	//    https://istio.io/latest/docs/reference/config/networking/virtual-service/#Headers-HeaderOperations
	//  - the following string templates are available:
	//     - `.PathPrefix`: the path prefix of the Workspace (e.g. '/workspace/{profile_name}/{workspace_name}/')
	//+kubebuilder:validation:Optional
	RequestHeaders *IstioHeaderOperations `json:"requestHeaders,omitempty"`
}

type IstioHeaderOperations struct {
	// overwrite the headers specified by key with the given values
	//+kubebuilder:validation:Optional
	//+kubebuilder:example:={ "X-RStudio-Root-Path": "{{ .PathPrefix }}" }
	Set map[string]string `json:"set,omitempty"`

	// append the given values to the headers specified by keys (will create a comma-separated list of values)
	//+kubebuilder:validation:Optional
	//+kubebuilder:example:={ "My-Header": "value-to-append" }
	Add map[string]string `json:"add,omitempty"`

	// remove the specified headers
	//+kubebuilder:validation:Optional
	//+kubebuilder:example:={"Header-To-Remove"}
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
	//+kubebuilder:validation:MinItems:=1
	//+listType:="map"
	//+listMapKey:="id"
	Values []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	// the id of this image config
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=256
	//+kubebuilder:example:="jupyterlab_scipy_190"
	Id string `json:"id"`

	// information for the spawner ui
	Spawner OptionSpawnerInfo `json:"spawner"`

	// redirect configs
	//+kubebuilder:validation:Optional
	Redirect *OptionRedirect `json:"redirect,omitempty"`

	// the spec of the image config
	Spec ImageConfigSpec `json:"spec"`
}

type ImageConfigSpec struct {
	// the container image to use
	//+kubebuilder:validation:MinLength:=2
	//+kubeflow:example="docker.io/kubeflownotebookswg/jupyter-scipy:v1.7.0"
	Image string `json:"image"`

	// the pull policy for the container image
	//+kubebuilder:validation:Optional
	//+kubebuilder:default:="IfNotPresent"
	//+kubebuilder:validation:Enum:={"Always","IfNotPresent","Never"}
	ImagePullPolicy *v1.PullPolicy `json:"imagePullPolicy"`

	// ports that the container listens on
	//   - if multiple ports are defined, the user will see multiple "Connect" buttons
	//     in a dropdown menu on the Workspace overview page
	//+kubebuilder:validation:MinItems:=1
	//+listType:="map"
	//+listMapKey:="id"
	Ports []ImagePort `json:"ports"`
}

type ImagePort struct {
	// the id of the port
	//  - this is NOT used as the Container or Service port name, but as part of the HTTP path
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=32
	//+kubebuilder:validation:Pattern:=^[a-z0-9][a-z0-9_-]*[a-z0-9]$
	//+kubebuilder:example="jupyterlab"
	Id string `json:"id"`

	// the port number
	//+kubebuilder:validation:Minimum:=1
	//+kubebuilder:validation:Maximum:=65535
	//+kubebuilder:example:=8888
	Port int32 `json:"port"`

	// the display name of the port
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=64
	//+kubebuilder:example:="JupyterLab"
	DisplayName string `json:"displayName"`

	// the protocol of the port
	//+kubebuilder:example:="HTTP"
	Protocol ImagePortProtocol `json:"protocol"`
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
	//+kubebuilder:validation:MinItems:=1
	//+listType:="map"
	//+listMapKey:="id"
	Values []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	// the id of this pod config
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=256
	//+kubebuilder:example="big_gpu"
	Id string `json:"id"`

	// information for the spawner ui
	Spawner OptionSpawnerInfo `json:"spawner"`

	// redirect configs
	//+kubebuilder:validation:Optional
	Redirect *OptionRedirect `json:"redirect,omitempty"`

	// the spec of the pod config
	Spec PodConfigSpec `json:"spec"`
}

type PodConfigSpec struct {
	// affinity configs for the pod
	//+kubebuilder:validation:Optional
	Affinity *v1.Affinity `json:"affinity,omitempty"`

	// node selector configs for the pod
	//+kubebuilder:validation:Optional
	NodeSelector map[string]string `json:"nodeSelector,omitempty"`

	// toleration configs for the pod
	//+kubebuilder:validation:Optional
	Tolerations []v1.Toleration `json:"tolerations,omitempty"`

	// resource configs for the "main" container in the pod
	//+kubebuilder:validation:Optional
	Resources *v1.ResourceRequirements `json:"resources,omitempty"`
}

type OptionsSpawnerConfig struct {
	// the id of the default option
	//  - this will be selected by default in the spawner ui
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=256
	//+kubebuilder:example="jupyterlab_scipy_190"
	Default string `json:"default"`
}

type OptionSpawnerInfo struct {
	// the display name of the option
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=128
	DisplayName string `json:"displayName"`

	// a description of the option
	//+kubebuilder:validation:Optional
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=1024
	Description *string `json:"description,omitempty"`

	// labels for the option
	//+kubebuilder:validation:Optional
	//+kubebuilder:validation:MaxItems:=32
	//+listType:="map"
	//+listMapKey:="key"
	Labels []OptionSpawnerLabel `json:"labels,omitempty"`

	// if this option should be hidden from the Workspace Spawner UI
	//+kubebuilder:validation:Optional
	//+kubebuilder:default:=false
	Hidden *bool `json:"hidden,omitempty"`
}

type OptionSpawnerLabel struct {
	// the key of the label
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=64
	Key string `json:"key"`

	// the value of the label
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=64
	Value string `json:"value"`
}

type OptionRedirect struct {
	// the id of the option to redirect to
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=256
	//+kubebuilder:example:="jupyterlab_scipy_190"
	To string `json:"to"`

	// information about the redirect
	//+kubebuilder:validation:Optional
	Message *RedirectMessage `json:"message,omitempty"`
}

type RedirectMessage struct {
	// the importance level of the message
	//+kubebuilder:example:="Info"
	Level RedirectMessageLevel `json:"level"`

	// the text of the message to show
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=1024
	//+kubebuilder:example:="This update will increase the version of JupyterLab to v1.7.1"
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
                            WorkspaceKind - Status
===============================================================================
*/

// WorkspaceKindStatus defines the observed state of WorkspaceKind
type WorkspaceKindStatus struct {

	// the number of Workspaces that are using this WorkspaceKind
	//+kubebuilder:default=0
	Workspaces int32 `json:"workspaces"`

	// metrics for podTemplate options
	PodTemplateOptions PodTemplateOptionsMetrics `json:"podTemplateOptions"`
}

type PodTemplateOptionsMetrics struct {
	// metrics about the imageConfig options
	//+listType:="map"
	//+listMapKey:="id"
	ImageConfig []OptionMetric `json:"imageConfig"`

	// metrics about the podConfig options
	//+listType:="map"
	//+listMapKey:="id"
	PodConfig []OptionMetric `json:"podConfig"`
}

type OptionMetric struct {
	// the id of the option
	//+kubebuilder:validation:MinLength:=1
	//+kubebuilder:validation:MaxLength:=256
	//+kubebuilder:example="big_gpu"
	Id string `json:"id"`

	// the number of Workspaces currently using the option
	//+kubebuilder:example=3
	Workspaces int32 `json:"workspaces"`
}

/*
===============================================================================
                                 WorkspaceKind
===============================================================================
*/

//+kubebuilder:object:root=true
//+kubebuilder:printcolumn:name="Workspaces",type="integer",JSONPath=".status.workspaces",description="The number of Workspaces using this WorkspaceKind"
//+kubebuilder:printcolumn:name="Deprecated",type="boolean",JSONPath=".spec.spawner.deprecated",description="If this WorkspaceKind is deprecated"
//+kubebuilder:printcolumn:name="Hidden",type="boolean",JSONPath=".spec.spawner.hidden",description="If this WorkspaceKind is hidden from the spawner UI"
//+kubebuilder:subresource:status
//+kubebuilder:resource:scope=Cluster

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

//+kubebuilder:object:root=true

// WorkspaceKindList contains a list of WorkspaceKind
type WorkspaceKindList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []WorkspaceKind `json:"items"`
}

func init() {
	SchemeBuilder.Register(&WorkspaceKind{}, &WorkspaceKindList{})
}
