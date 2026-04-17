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

import (
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

type ListValuesRequest struct {
	Context ListValuesContext `json:"context"`
}

// Validate validates the ListValuesRequest struct.
func (d *ListValuesRequest) Validate(prefix *field.Path) []*field.Error {
	var errs field.ErrorList

	// validate the context
	contextPath := prefix.Child("context")
	errs = append(errs, d.Context.Validate(contextPath)...)

	return errs
}

type ListValuesContext struct {
	Namespace   *ContextNamespace   `json:"namespace,omitempty"`
	PodConfig   *ContextPodConfig   `json:"podConfig,omitempty"`
	ImageConfig *ContextImageConfig `json:"imageConfig,omitempty"`
}

// Validate validates the ListValuesContext struct.
func (c *ListValuesContext) Validate(prefix *field.Path) []*field.Error {
	var errs field.ErrorList

	// validate the namespace context, if present
	if c.Namespace != nil {
		namespacePath := prefix.Child("namespace")
		errs = append(errs, c.Namespace.Validate(namespacePath)...)
	}

	// validate the podConfig context, if present
	if c.PodConfig != nil {
		podConfigPath := prefix.Child("podConfig")
		errs = append(errs, c.PodConfig.Validate(podConfigPath)...)
	}

	// validate the imageConfig context, if present
	if c.ImageConfig != nil {
		imageConfigPath := prefix.Child("imageConfig")
		errs = append(errs, c.ImageConfig.Validate(imageConfigPath)...)
	}

	return errs
}

type ContextNamespace struct {
	Name string `json:"name"`
}

// Validate validates the ContextNamespace struct.
func (c *ContextNamespace) Validate(prefix *field.Path) []*field.Error {
	var errs field.ErrorList

	// validate the namespace name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateKubernetesNamespaceName(namePath, c.Name)...)

	return errs
}

type ContextPodConfig struct {
	Id string `json:"id"`
}

// Validate validates the ContextPodConfig struct.
func (c *ContextPodConfig) Validate(prefix *field.Path) []*field.Error {
	var errs field.ErrorList

	// validate the pod config id
	idPath := prefix.Child("id")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(idPath, c.Id)...)

	return errs
}

type ContextImageConfig struct {
	Id string `json:"id"`
}

// Validate validates the ContextImageConfig struct.
func (c *ContextImageConfig) Validate(prefix *field.Path) []*field.Error {
	var errs field.ErrorList

	// validate the image config id
	idPath := prefix.Child("id")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(idPath, c.Id)...)

	return errs
}
