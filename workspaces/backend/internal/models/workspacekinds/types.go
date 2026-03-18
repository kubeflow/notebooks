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

import (
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

type WorkspaceKind struct {
	Name               string         `json:"name"`
	DisplayName        string         `json:"displayName"`
	Description        string         `json:"description"`
	Deprecated         bool           `json:"deprecated"`
	DeprecationMessage string         `json:"deprecationMessage"`
	Hidden             bool           `json:"hidden"`
	Icon               ImageRef       `json:"icon"`
	Logo               ImageRef       `json:"logo"`
	ClusterMetrics     clusterMetrics `json:"clusterMetrics,omitempty"`
	PodTemplate        PodTemplate    `json:"podTemplate"`
}

type clusterMetrics struct {
	Workspaces int32 `json:"workspacesCount"`
}

type ImageRef struct {
	URL string `json:"url"`
}

type PodTemplate struct {
	PodMetadata  PodMetadata        `json:"podMetadata"`
	VolumeMounts PodVolumeMounts    `json:"volumeMounts"`
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
	ImageConfig ImageConfig `json:"imageConfig"`
	PodConfig   PodConfig   `json:"podConfig"`
}

type ImageConfig struct {
	Default string             `json:"default"`
	Values  []ImageConfigValue `json:"values"`
}

type ImageConfigValue struct {
	Id             string          `json:"id"`
	DisplayName    string          `json:"displayName"`
	Description    string          `json:"description"`
	Labels         []OptionLabel   `json:"labels"`
	Hidden         bool            `json:"hidden"`
	Redirect       *OptionRedirect `json:"redirect,omitempty"`
	ClusterMetrics clusterMetrics  `json:"clusterMetrics,omitempty"`
}

type PodConfig struct {
	Default string           `json:"default"`
	Values  []PodConfigValue `json:"values"`
}

type PodConfigValue struct {
	Id             string          `json:"id"`
	DisplayName    string          `json:"displayName"`
	Description    string          `json:"description"`
	Labels         []OptionLabel   `json:"labels"`
	Hidden         bool            `json:"hidden"`
	Redirect       *OptionRedirect `json:"redirect,omitempty"`
	ClusterMetrics clusterMetrics  `json:"clusterMetrics,omitempty"`
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

type ListValuesRequest struct {
	Context *ListValuesContext `json:"context,omitempty"`
}

// Validate validates the listvalues request data by delegating to Context when present.
func (d *ListValuesRequest) Validate(prefix *field.Path) field.ErrorList {
	var errs field.ErrorList
	if d == nil {
		return errs
	}
	if d.Context != nil {
		errs = append(errs, d.Context.Validate(prefix.Child("context"))...)
	}
	return errs
}

type ListValuesContext struct {
	Namespace   *ContextNamespace   `json:"namespace,omitempty"`
	PodConfig   *ContextPodConfig   `json:"podConfig,omitempty"`
	ImageConfig *ContextImageConfig `json:"imageConfig,omitempty"`
}

// Validate validates the context (e.g. context.namespace.name when set).
func (c *ListValuesContext) Validate(prefix *field.Path) field.ErrorList {
	var errs field.ErrorList
	if c == nil {
		return errs
	}
	if c.Namespace != nil {
		errs = append(errs, helper.ValidateKubernetesNamespaceName(prefix.Child("namespace", "name"), c.Namespace.Name)...)
	}
	return errs
}

type ContextNamespace struct {
	Name string `json:"name"`
}

type ContextPodConfig struct {
	Id string `json:"id"`
}

type ContextImageConfig struct {
	Id string `json:"id"`
}

type ListValuesResponse struct {
	ImageConfig ImageConfigWithRules `json:"imageConfig"`
	PodConfig   PodConfigWithRules   `json:"podConfig"`
}

type ImageConfigWithRules struct {
	Default string                      `json:"default"`
	Values  []ImageConfigValueWithRules `json:"values"`
}

type ImageConfigValueWithRules struct {
	Id             string          `json:"id"`
	DisplayName    string          `json:"displayName"`
	Description    string          `json:"description"`
	Labels         []OptionLabel   `json:"labels"`
	Hidden         bool            `json:"hidden"`
	Redirect       *OptionRedirect `json:"redirect,omitempty"`
	ClusterMetrics clusterMetrics  `json:"clusterMetrics,omitempty"`
	RuleEffects    RuleEffects     `json:"ruleEffects"`
}

type PodConfigWithRules struct {
	Default string                    `json:"default"`
	Values  []PodConfigValueWithRules `json:"values"`
}

type PodConfigValueWithRules struct {
	Id             string          `json:"id"`
	DisplayName    string          `json:"displayName"`
	Description    string          `json:"description"`
	Labels         []OptionLabel   `json:"labels"`
	Hidden         bool            `json:"hidden"`
	Redirect       *OptionRedirect `json:"redirect,omitempty"`
	ClusterMetrics clusterMetrics  `json:"clusterMetrics,omitempty"`
	RuleEffects    RuleEffects     `json:"ruleEffects"`
}

type RuleEffects struct {
	UiHide bool `json:"uiHide"`
}
