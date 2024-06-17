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
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// WorkspaceKindSpec defines the desired state of WorkspaceKind
type WorkspaceKindSpec struct {

	// spawner config determines how the WorkspaceKind is displayed in the Workspace Spawner UI
	//+kubebuilder:validation:Required
	Spawner Spawner `json:"spawner"`

	// podTemplate is the PodTemplate used to spawn Pods to run Workspaces of this WorkspaceKind
	//+kubebuilder:validation:Required
	PodTemplate WorkspaceKindPodTemplate `json:"podTemplate"`

	// in the future, there will be MORE template types like
	//  `virtualMachine` to run the Workspace on systems like KubeVirt/EC2 rather than in a Pod
}

// WorkspaceKindStatus defines the observed state of WorkspaceKind
type WorkspaceKindStatus struct {
	// INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
	// Important: Run "make" to regenerate code after modifying this file
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:resource:scope=Cluster

// WorkspaceKind is the Schema for the workspacekinds API
type WorkspaceKind struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WorkspaceKindSpec   `json:"spec,omitempty"`
	Status WorkspaceKindStatus `json:"status,omitempty"`
}

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

type Spawner struct {
	// the display name of the WorkspaceKind
	//+kubebuilder:example:="JupyterLab Notebook"
	DisplayName string `json:"displayName"`

	// the description of the WorkspaceKind
	//+kubebuilder:example:="A Workspace which runs JupyterLab in a Pod"
	Description string `json:"description"`

	// if this WorkspaceKind should be hidden from the Workspace Spawner UI
	//+kubebuilder:default:=false
	Hidden bool `json:"hidden,omitempty"`

	// if this WorkspaceKind is deprecated
	//+kubebuilder:default:=false
	//+kubebuilder:validation:Optional
	Deprecated bool `json:"deprecated,omitempty"`

	// a message to show in Workspace Spawner UI when the WorkspaceKind is deprecated
	//+kubebuilder:example:="This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind."
	//+kubebuilder:validation:Optional
	DeprecationMessage string `json:"deprecationMessage,omitempty"`

	// a small (favicon-sized) icon of the WorkspaceKind used in the Workspaces overview table
	Icon WorkspaceKindIcon `json:"icon"`

	// a 1:1 (card size) logo of the WorkspaceKind used in the Workspace Spawner UI
	Logo WorkspaceKindIcon `json:"logo"`
}

type WorkspaceKindPodTemplate struct {
	// metadata for Workspace Pods (MUTABLE)
	PodMetadata WorkspaceKindPodMetadata `json:"podMetadata,omitempty"`

	// service account configs for Workspace Pods (NOT MUTABLE)
	//+kubebuilder:validation:Required
	ServiceAccount ServiceAccount `json:"serviceAccount"`

	// culling configs for pausing inactive Workspaces (MUTABLE)
	Culling WorkspaceKindCullingConfig `json:"culling,omitempty"`

	// standard probes to determine Container health (MUTABLE)
	//  updates to existing Workspaces are applied through the "pending restart" feature
	Probes Probes `json:"probes,omitempty"`

	// volume mount paths (NOT MUTABLE)
	//+kubebuilder:validation:Required
	VolumeMounts VolumeMounts `json:"volumeMounts"`

	// http proxy configs (MUTABLE)
	HTTPProxy HTTPProxy `json:"httpProxy,omitempty"`

	// environment variables for Workspace Pods (MUTABLE)
	//  updates to existing Workspaces are applied through the "pending restart" feature
	//
	// The following string templates are available:
	//   - .PathPrefix: the path prefix of the Workspace (e.g. '/workspace/{profile_name}/{workspace_name}/')
	//
	// For example, to enable backwards compatibility with the old Jupyter images, from Kubeflow Notebooks 1.8
	//  (https://github.com/kubeflow/kubeflow/blob/v1.8.0/components/example-notebook-servers/jupyter/s6/services.d/jupyterlab/run#L12)
	//
	//	- name: "NB_PREFIX"
	//	  value: "{{ .PathPrefix }}"
	ExtraEnv []v1.EnvVar `json:"extraEnv,omitempty"`

	// options are the user-selectable fields, they determine the PodSpec of the Workspace
	Options KindOptions `json:"options"`
}

// +kubebuilder:validation:XValidation:message="must specify exactly one of 'url' or 'configMap'",rule="!(has(self.url) && has(self.configMap)) && (has(self.url) || has(self.configMap))"
type WorkspaceKindIcon struct {
	//+kubebuilder:example="https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png"
	//+kubebuilder:validation:Optional
	Url *string `json:"url,omitempty"`

	//+kubebuilder:validation:Optional
	ConfigMap *WorkspaceKindConfigMap `json:"configMap,omitempty"`
}

type WorkspaceKindConfigMap struct {
	//+kubebuilder:example="my-logos"
	//+kubebuilder:validation:Required
	Name string `json:"name"`

	//+kubebuilder:example="apple-touch-icon-152x152.png"
	//+kubebuilder:validation:Required
	Key string `json:"key"`
}

// metadata for Workspace Pods (MUTABLE)
type WorkspaceKindPodMetadata struct {
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

type ServiceAccount struct {
	// the name of the ServiceAccount; this Service Account MUST already exist in the Namespace of the Workspace,
	//  the controller will NOT create it. We will not show this WorkspaceKind in the Spawner UI if the SA does not exist in the Namespace.
	//+kubebuilder:example="default-editor"
	Name string `json:"name"`
}

type WorkspaceKindCullingConfig struct {
	// if the culling feature is enabled
	//+kubebuilder:default=true
	Enabled bool `json:"enabled,omitempty"`

	// the maximum number of seconds a Workspace can be inactive
	//+kubebuilder:default=86400
	MaxInactiveSeconds int `json:"maxInactiveSeconds,omitempty"`

	// the probe used to determine if the Workspace is active
	//+kubebuilder:validation:Required
	ActivityProbe WorkspaceKindActivityProbe `json:"activityProbe"`
}

// +kubebuilder:validation:XValidation:message="must specify exactly one of 'exec' or 'jupyter'",rule="!(has(self.exec) && has(self.jupyter)) && (has(self.exec) || has(self.jupyter))"
type WorkspaceKindActivityProbe struct {
	// a "shell" command to run in the Workspace, if the Workspace had activity in the last 60 seconds, this command
	//  should return status 0, otherwise it should return status 1
	Exec *WorkspaceKindActivityProbeExec `json:"exec,omitempty"`

	// a Jupyter-specific probe will poll the /api/status endpoint of the Jupyter API, and use the last_activity field
	//  Users need to be careful that their other probes don't trigger a "last_activity" update,
	//	e.g. they should only check the health of Jupyter using the /api/status endpoint
	Jupyter *WorkspaceKindActivityProbeJupyter `json:"jupyter,omitempty"`
}

type WorkspaceKindActivityProbeExec struct {
	//+kubebuilder:example={"bash", "-c", "exit 0"}
	//+kubebuilder:validation:Required
	Command []string `json:"command"`
}

type WorkspaceKindActivityProbeJupyter struct {
	//+kubebuilder:example=true
	//+kubebuilder:validation:Required
	LastActivity bool `json:"lastActivity"`
}

type Probes struct {
	//+kubebuilder:validation:Optional
	StartupProbe *v1.Probe `json:"startupProbe,omitempty"`

	//+kubebuilder:validation:Optional
	LivenessProbe *v1.Probe `json:"livenessProbe,omitempty"`

	//+kubebuilder:validation:Optional
	ReadinessProbe *v1.Probe `json:"readinessProbe,omitempty"`
}

type VolumeMounts struct {
	//+kubebuilder:validation:MinLength:=2
	//+kubebuilder:validation:MaxLength:=4096
	//+kubebuilder:validation:Pattern:=^/[^\0]+$
	//+kubebuilder:example:="/home/jovyan"
	Home string `json:"home"`
}

type HTTPProxy struct {
	// if the '/workspace/{profile_name}/{workspace_name}/' prefix is to be stripped from incoming HTTP requests
	//  this only works if the application serves RELATIVE URLs for its assets
	//+kubebuilder:default:=false
	//+kubebuilder:validation:Optional
	RemovePathPrefix bool `json:"removePathPrefix,omitempty"`

	// header manipulation rules for incoming HTTP requests, sets the spec.http[].headers.request of the Istio VirtualService
	//  https://istio.io/latest/docs/reference/config/networking/virtual-service/#Headers-HeaderOperations
	//
	// The following string templates are available:
	//  - .PathPrefix: the path prefix of the Workspace (e.g. '/workspace/{profile_name}/{workspace_name}/')
	//+kubebuilder:validation:Optional
	RequestHeaders []RequestHeader `json:"requestHeaders,omitempty"`
}

type RequestHeader struct {
	//+kubebuilder:example:={ "X-RStudio-Root-Path": "{{ .PathPrefix }}" }
	Set map[string]string `json:"set,omitempty"`

	Append map[string]string `json:"append,omitempty"`

	Remove []string `json:"remove,omitempty"`
}

type ExtraEnv struct {
	//+kubebuilder:example:="NB_PREFIX"
	Name string `json:"name"`

	//+kubebuilder:example:="{{ .PathPrefix }}"
	Value string `json:"value"`
}

type KindOptions struct {
	// imageConfig options determine the container image
	ImageConfig ImageConfig `json:"imageConfig"`

	// podConfig options determine pod affinity, nodeSelector, tolerations, resources
	PodConfig PodConfig `json:"podConfig"`
}

type ImageConfig struct {
	// the id of the default image config for this WorkspaceKind
	//+kubebuilder:example:="jupyter_scipy_171"
	Default string `json:"default"`

	// the list of image configs that are available to choose from
	Values []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	//+kubebuilder:example:="jupyter_scipy_171"
	Id string `json:"id"`

	Spawner ImageConfigSpawner `json:"spawner"`

	//+kubebuilder:validation:Optional
	Redirect OptionRedirect `json:"redirect,omitempty"`

	Spec ImageConfigSpec `json:"spec"`
}

type ImageConfigSpawner struct {
	//+kubebuilder:example:="jupyter-scipy:v1.7.0"
	DisplayName string `json:"displayName"`

	//+kubebuilder:example:="JupyterLab 1.7.0, with SciPy Packages"
	Description string `json:"description"`

	// if this ImageConfig should be hidden from the Workspace Spawner UI
	//+kubebuilder:default:=false
	//+kubebuilder:validation:Optional
	Hidden bool `json:"hidden,omitempty"`
}

type OptionRedirect struct {
	//+kubebuilder:example:="jupyter_scipy_171"
	To string `json:"to"`

	//+kubebuilder:example:=true
	WaitForRestart bool `json:"waitForRestart"`
}

type ImageConfigSpec struct {
	// the container image to use
	//+kubeflow:example="docker.io/kubeflownotebookswg/jupyter-scipy:v1.7.0"
	Image string `json:"image"`

	// ports that the container listens on, currently, only HTTP is supported for `protocol`
	//  if multiple ports are defined, the user will see multiple "Connect" buttons in a dropdown menu on the Workspace overview page
	Ports []v1.EndpointPort `json:"ports"`
}

type PodConfig struct {
	// the id of the default pod config
	//+kubebuilder:example="small-cpu"
	Default string `json:"default"`

	// the list of pod configs that are available
	Values []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	//+kubebuilder:example="small-cpu"
	Id string `json:"id"`

	Spawner PodConfigSpawner `json:"spawner"`

	//+kubebuilder:validation:Optional
	Redirect OptionRedirect `json:"redirect,omitempty"`
	Spec     PodConfigSpec  `json:"spec"`
}

type PodConfigSpawner struct {
	//+kubebuilder:example:="Small CPU"
	//+kubebuilder:validation:Required
	DisplayName string `json:"display_name"`

	//+kubebuilder:example:="Pod with 1 CPU, 2 GB RAM, and 1 GPU"
	//+kubebuilder:validation:Required
	Description string `json:"description"`

	//+kubebuilder:default:=false
	Hidden bool `json:"hidden,omitempty"`
}

type PodConfigSpec struct {
	// affinity configs for the pod (https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.27/#affinity-v1-core)
	//+kubebuilder:validation:Optional
	Affinity v1.Affinity `json:"affinity,omitempty"`

	// node selector configs for the pod (https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#nodeselector)
	//+kubebuilder:validation:Optional
	NodeSelector *v1.NodeSelector `json:"nodeSelector,omitempty"`

	// toleration configs for the pod (https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.27/#toleration-v1-core)
	//+kubebuilder:validation:Optional
	Tolerations []v1.Toleration `json:"tolerations,omitempty"`

	// resource configs for the "main" container in the pod (https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.27/#resourcerequirements-v1-core)
	//+kubebuilder:validation:Optional
	Resources v1.ResourceRequirements `json:"resources,omitempty"`
}
