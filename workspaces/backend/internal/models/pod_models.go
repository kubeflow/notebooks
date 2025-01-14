package models

type WorkspaceKindPodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type ImageConfig struct {
	Default string             `json:"default"`
	Values  []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	Id          string            `json:"id"`
	DisplayName string            `json:"displayName"`
	Labels      map[string]string `json:"labels,omitempty"`
	Hidden      *bool             `json:"hidden,omitempty"`
	Redirect    *OptionRedirect   `json:"redirect,omitempty"`
}

type PodConfig struct {
	Default string           `json:"default"`
	Values  []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	Id          string            `json:"id"`
	DisplayName string            `json:"displayName"`
	Description string            `json:"description"`
	Labels      map[string]string `json:"labels,omitempty"`
}

type OptionRedirect struct {
	To      string   `json:"to"`
	Message *Message `json:"message,omitempty"`
}

type Message struct {
	Text  string `json:"text"`
	Level string `json:"level"`
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
