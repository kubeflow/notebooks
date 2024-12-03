package models

import v1 "k8s.io/api/core/v1"

type WorkspaceKindPodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type ImageConfig struct {
	Default string             `json:"default"`
	Values  []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	Id       string            `json:"id"`
	Spawner  OptionSpawnerInfo `json:"spawner"`
	Redirect *OptionRedirect   `json:"redirect,omitempty"`
	Spec     ImageConfigSpec   `json:"spec"`
}
type OptionSpawnerInfo struct {
	DisplayName string               `json:"displayName"`
	Description *string              `json:"description,omitempty"`
	Labels      []OptionSpawnerLabel `json:"labels,omitempty"`
	Hidden      *bool                `json:"hidden,omitempty"`
}

type OptionSpawnerLabel struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type ImageConfigSpec struct {
	Image           string      `json:"image"`
	ImagePullPolicy string      `json:"imagePullPolicy"`
	Ports           []ImagePort `json:"ports"`
}

type ImagePort struct {
	Id          string `json:"id"`
	Port        int32  `json:"port"`
	DisplayName string `json:"displayName"`
	Protocol    string `json:"protocol"`
}

type PodConfig struct {
	Default string           `json:"default"`
	Values  []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	Id       string            `json:"id"`
	Spawner  OptionSpawnerInfo `json:"spawner"`
	Redirect *OptionRedirect   `json:"redirect,omitempty"`
	Spec     PodConfigSpec     `json:"spec"`
}

type OptionRedirect struct {
	To      string           `json:"to"`
	Message *RedirectMessage `json:"message,omitempty"`
}

type RedirectMessage struct {
	Level string `json:"level"`
	Text  string `json:"text"`
}

type PodConfigSpec struct {
	Affinity     *v1.Affinity             `json:"affinity,omitempty"`
	NodeSelector map[string]string        `json:"nodeSelector,omitempty"`
	Tolerations  []v1.Toleration          `json:"tolerations,omitempty"`
	Resources    *v1.ResourceRequirements `json:"resources,omitempty"`
}

type WorkspaceKindPodOptions struct {
	ImageConfig ImageConfig `json:"image_config"`
	PodConfig   PodConfig   `json:"pod_config"`
}

type PodTemplateModel struct {
	PodMetadata WorkspaceKindPodMetadata `json:"pod_metadata"`
	VolumeMount map[string]string        `json:"volume_mounts"`
	Options     WorkspaceKindPodOptions  `json:"options"`
}
