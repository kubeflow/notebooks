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

package options

type PodTemplateOptions struct {
	ImageConfig ImageConfig `json:"imageConfig"`
	PodConfig   PodConfig   `json:"podConfig"`
}

type ClusterOptionMetrics struct {
	Workspaces int32 `json:"workspacesCount"`
}

type ImageConfig struct {
	Default string             `json:"default"`
	Values  []ImageConfigValue `json:"values,omitempty"`
}

type ImageConfigValue struct {
	Id             string               `json:"id"`
	DisplayName    string               `json:"displayName"`
	Description    string               `json:"description"`
	Labels         []OptionLabel        `json:"labels,omitempty"`
	Hidden         bool                 `json:"hidden"`
	Redirect       *OptionRedirect      `json:"redirect,omitempty"`
	ClusterMetrics ClusterOptionMetrics `json:"clusterMetrics,omitempty"`
}

type PodConfig struct {
	Default string           `json:"default"`
	Values  []PodConfigValue `json:"values,omitempty"`
}

type PodConfigValue struct {
	Id             string               `json:"id"`
	DisplayName    string               `json:"displayName"`
	Description    string               `json:"description"`
	Labels         []OptionLabel        `json:"labels,omitempty"`
	Hidden         bool                 `json:"hidden"`
	Redirect       *OptionRedirect      `json:"redirect,omitempty"`
	ClusterMetrics ClusterOptionMetrics `json:"clusterMetrics,omitempty"`
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
