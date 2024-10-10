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
	"strings"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

type WorkspaceKindModel struct {
	Name        string            `json:"name"`
	PodTemplate PodTemplateModel  `json:"pod_template"`
	Spawner     SpawnerModel      `json:"spawner"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

type PodTemplateModel struct {
	ImageConfig string        `json:"image_config"`
	PodConfig   string        `json:"pod_config"`
	Resources   ResourceModel `json:"resources"`
}

type ResourceModel struct {
	Cpu    string `json:"cpu"`
	Memory string `json:"memory"`
}

type SpawnerModel struct {
	DisplayName        string `json:"display_name"`
	Description        string `json:"description"`
	Deprecated         bool   `json:"deprecated"`
	DeprecationMessage string `json:"deprecation_message"`
	Hidden             bool   `json:"hidden"`
}

func NewWorkspaceKindModelFromWorkspaceKind(item *kubefloworgv1beta1.WorkspaceKind) WorkspaceKindModel {
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

	cpuValues := make([]string, len(item.Spec.PodTemplate.Options.PodConfig.Values))
	memoryValues := make([]string, len(item.Spec.PodTemplate.Options.PodConfig.Values))
	for i, value := range item.Spec.PodTemplate.Options.PodConfig.Values {
		cpuValues[i] = value.Spec.Resources.Requests.Cpu().String()
		memoryValues[i] = value.Spec.Resources.Requests.Memory().String()
	}

	workspaceKindModel := WorkspaceKindModel{
		Name:        item.Name,
		Labels:      item.Labels,
		Annotations: item.Annotations,
		Spawner: SpawnerModel{
			DisplayName:        item.Spec.Spawner.DisplayName,
			Description:        item.Spec.Spawner.Description,
			Deprecated:         deprecated,
			DeprecationMessage: deprecationMessage,
			Hidden:             hidden,
		},
		PodTemplate: PodTemplateModel{
			ImageConfig: item.Spec.PodTemplate.Options.ImageConfig.Spawner.Default,
			PodConfig:   strings.Join(cpuValues, ",") + "|" + strings.Join(memoryValues, ","),
			Resources: ResourceModel{
				Cpu:    strings.Join(cpuValues, ", "),
				Memory: strings.Join(memoryValues, ", "),
			},
		},
	}

	return workspaceKindModel
}
