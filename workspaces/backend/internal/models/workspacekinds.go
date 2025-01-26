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

package models

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

type WorkspaceKindModel struct {
	Name               string            `json:"name"`
	DisplayName        string            `json:"display_name"`
	Description        string            `json:"description"`
	Deprecated         bool              `json:"deprecated"`
	DeprecationMessage string            `json:"deprecation_message"`
	Hidden             bool              `json:"hidden"`
	Icon               map[string]string `json:"icon"`
	Logo               map[string]string `json:"logo"`
	PodTemplate        PodTemplateModel  `json:"pod_template"`
}

func buildImageConfigValues(item *kubefloworgv1beta1.WorkspaceKind) []ImageConfigValue {
	imageConfigValues := []ImageConfigValue{}
	if item.Spec.PodTemplate.Options.ImageConfig.Values != nil {
		for _, item := range item.Spec.PodTemplate.Options.ImageConfig.Values {
			labels := map[string]string{}
			for _, label := range item.Spawner.Labels {
				labels[label.Key] = label.Value
			}

			var redirect *OptionRedirect
			if item.Redirect != nil {
				redirect = &OptionRedirect{
					To: item.Redirect.To,
					Message: &Message{
						Text:  item.Redirect.Message.Text,
						Level: string(item.Redirect.Message.Level),
					},
				}
			}

			imageConfigValues = append(imageConfigValues, ImageConfigValue{
				Id:          item.Id,
				DisplayName: item.Spawner.DisplayName,
				Labels:      labels,
				Hidden:      item.Spawner.Hidden,
				Redirect:    redirect,
			})
		}
	}
	return imageConfigValues
}

func buildPodConfigValues(item *kubefloworgv1beta1.WorkspaceKind) []PodConfigValue {
	podConfigValues := []PodConfigValue{}
	if item.Spec.PodTemplate.Options.PodConfig.Values != nil {
		for _, item := range item.Spec.PodTemplate.Options.PodConfig.Values {
			labels := map[string]string{}
			for _, label := range item.Spawner.Labels {
				labels[label.Key] = label.Value
			}

			podConfigValues = append(podConfigValues, PodConfigValue{
				Id:          item.Id,
				DisplayName: item.Spawner.DisplayName,
				Description: *item.Spawner.Description,
				Labels:      labels,
			})
		}
	}
	return podConfigValues
}

func NewWorkspaceKindModelFromWorkspaceKind(item *kubefloworgv1beta1.WorkspaceKind) WorkspaceKindModel {
	imageConfigValues := buildImageConfigValues(item)
	podConfigValues := buildPodConfigValues(item)

	labels := map[string]string{}
	if item.Spec.PodTemplate.PodMetadata.Labels != nil {
		labels = item.Spec.PodTemplate.PodMetadata.Labels
	}

	annotations := map[string]string{}
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

	icon := map[string]string{"url": ""}
	if item.Spec.Spawner.Icon.Url != nil {
		icon["url"] = *item.Spec.Spawner.Icon.Url
	}

	logo := map[string]string{"url": ""}
	if item.Spec.Spawner.Logo.Url != nil {
		logo["url"] = *item.Spec.Spawner.Logo.Url
	}

	volumeMounts := map[string]string{"home": ""}
	if item.Spec.PodTemplate.VolumeMounts.Home != "" {
		volumeMounts["home"] = item.Spec.PodTemplate.VolumeMounts.Home
	}

	return WorkspaceKindModel{
		Name:               item.Name,
		DisplayName:        item.Spec.Spawner.DisplayName,
		Description:        item.Spec.Spawner.Description,
		Deprecated:         deprecated,
		DeprecationMessage: deprecationMessage,
		Hidden:             hidden,
		Icon:               icon,
		Logo:               logo,
		PodTemplate: PodTemplateModel{
			PodMetadata: WorkspaceKindPodMetadata{
				Labels:      labels,
				Annotations: annotations,
			},
			VolumeMount: volumeMounts,
			Options: WorkspaceKindPodOptions{
				ImageConfig: ImageConfig{
					Default: item.Spec.PodTemplate.Options.ImageConfig.Spawner.Default,
					Values:  imageConfigValues,
				},
				PodConfig: PodConfig{
					Default: item.Spec.PodTemplate.Options.PodConfig.Spawner.Default,
					Values:  podConfigValues,
				},
			},
		},
	}
}
