/*
 *
 * Copyright 2024.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

package models

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

type WorkspaceKindModel struct {
	Name        string           `json:"name"`
	Spawner     SpawnerModel     `json:"spawner"`
	PodTemplate PodTemplateModel `json:"pod_template"`
}

type SpawnerModel struct {
	DisplayName        string `json:"display_name"`
	Description        string `json:"description"`
	Deprecated         bool   `json:"deprecated"`
	DeprecationMessage string `json:"deprecation_message"`
	Hidden             bool   `json:"hidden"`
}

type PodTemplateModel struct {
	PodMetadata PodMetadata       `json:"pod_metadata"`
	ImageConfig PodTemplateConfig `json:"image_config"`
	PodConfig   PodTemplateConfig `json:"pod_config"`
}

func NewWorkspaceKindModelFromWorkspaceKind(item *kubefloworgv1beta1.WorkspaceKind) WorkspaceKindModel {

	var image_redirect_chain []Redirect
	for _, item := range item.Spec.PodTemplate.Options.ImageConfig.Values {
		if item.Redirect != nil {
			image_redirect_chain = append(image_redirect_chain, Redirect{Source: item.Id, Target: item.Redirect.To})
		}
	}

	var pod_redirect_chain []Redirect
	if item.Spec.PodTemplate.Options.PodConfig.Values != nil {
		Default := item.Spec.PodTemplate.Options.PodConfig.Spawner.Default
		for _, item := range item.Spec.PodTemplate.Options.PodConfig.Values {
			pod_redirect_chain = append(pod_redirect_chain, Redirect{Source: Default, Target: item.Id})
		}
	}

	labels := make(map[string]string)
	if item.Spec.PodTemplate.PodMetadata.Labels != nil {
		labels = item.Spec.PodTemplate.PodMetadata.Labels
	}
	annotations := make(map[string]string)
	if item.Spec.PodTemplate.PodMetadata.Annotations != nil {
		annotations = item.Spec.PodTemplate.PodMetadata.Annotations
	}

	deprecated := false
	if item.Spec.Spawner.Deprecated != nil {
		deprecated = *item.Spec.Spawner.Deprecated
	}

	hidden := false
	if item.Spec.Spawner.Hidden != nil {
		hidden = *item.Spec.Spawner.Hidden
	}

	deprecationMessage := ""
	if item.Spec.Spawner.DeprecationMessage != nil {
		deprecationMessage = *item.Spec.Spawner.DeprecationMessage
	}

	workspaceKindModel := WorkspaceKindModel{
		Name: item.Name,
		Spawner: SpawnerModel{
			DisplayName:        item.Spec.Spawner.DisplayName,
			Description:        item.Spec.Spawner.Description,
			Deprecated:         deprecated,
			DeprecationMessage: deprecationMessage,
			Hidden:             hidden,
		},
		PodTemplate: PodTemplateModel{
			PodMetadata: PodMetadata{
				Labels:      labels,
				Annotations: annotations,
			},
			ImageConfig: PodTemplateConfig{
				Current:       item.Spec.PodTemplate.Options.ImageConfig.Spawner.Default,
				Desired:       item.Spec.PodTemplate.Options.ImageConfig.Spawner.Default,
				RedirectChain: image_redirect_chain,
			},
			PodConfig: PodTemplateConfig{
				Current:       item.Spec.PodTemplate.Options.PodConfig.Spawner.Default,
				Desired:       item.Spec.PodTemplate.Options.PodConfig.Spawner.Default,
				RedirectChain: pod_redirect_chain,
			},
		},
	}

	return workspaceKindModel
}
