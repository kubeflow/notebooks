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

type WorkspaceKind struct {
	Name               string      `json:"name"`
	DisplayName        string      `json:"display_name"`
	Description        string      `json:"description"`
	Deprecated         bool        `json:"deprecated"`
	DeprecationMessage string      `json:"deprecation_message"`
	Hidden             bool        `json:"hidden"`
	Icon               ImageRef    `json:"icon"`
	Logo               ImageRef    `json:"logo"`
	PodTemplate        PodTemplate `json:"pod_template"`
}

type ImageRef struct {
	URL string `json:"url"`
}

type PodTemplate struct {
	PodMetadata  PodMetadata        `json:"pod_metadata"`
	VolumeMounts PodVolumeMounts    `json:"volume_mounts"`
	Options      PodTemplateOptions `json:"options"`
}

type PodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type PodVolumeMounts struct {
	Home string `json:"home"`
}

type PodTemplateOptions struct {
	ImageConfig ImageConfig `json:"image_config"`
	PodConfig   PodConfig   `json:"pod_config"`
}

type ImageConfig struct {
	Default string             `json:"default"`
	Values  []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	Id          string          `json:"id"`
	DisplayName string          `json:"displayName"`
	Description string          `json:"description"`
	Labels      []OptionLabel   `json:"labels"`
	Hidden      bool            `json:"hidden"`
	Redirect    *OptionRedirect `json:"redirect,omitempty"`
}

type PodConfig struct {
	Default string           `json:"default"`
	Values  []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	Id          string          `json:"id"`
	DisplayName string          `json:"displayName"`
	Description string          `json:"description"`
	Labels      []OptionLabel   `json:"labels"`
	Hidden      bool            `json:"hidden"`
	Redirect    *OptionRedirect `json:"redirect,omitempty"`
}

type OptionLabel struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type OptionRedirect struct {
	To      string           `json:"to"`
	Message *RedirectMessage `json:"message,omitempty"`
}

type RedirectMessage struct {
	Text  string               `json:"text"`
	Level RedirectMessageLevel `json:"level"`
}

type RedirectMessageLevel string

const (
	RedirectMessageLevelInfo    RedirectMessageLevel = "Info"
	RedirectMessageLevelWarning RedirectMessageLevel = "Warning"
	RedirectMessageLevelDanger  RedirectMessageLevel = "Danger"
)
