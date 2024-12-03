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
	v1 "k8s.io/api/core/v1"
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

func BuildImageConfigValues(item *kubefloworgv1beta1.WorkspaceKind) []ImageConfigValue {
	imageConfigValues := []ImageConfigValue{}
	if item.Spec.PodTemplate.Options.ImageConfig.Values != nil {
		for _, item := range item.Spec.PodTemplate.Options.ImageConfig.Values {
			labels := []OptionSpawnerLabel{}
			for _, label := range item.Spawner.Labels {
				labels = append(labels, OptionSpawnerLabel{
					Key:   label.Key,
					Value: label.Value,
				})
			}

			ports := []ImagePort{}
			for _, port := range item.Spec.Ports {
				ports = append(ports, ImagePort{
					Id:          port.Id,
					DisplayName: port.DisplayName,
					Port:        port.Port,
					Protocol:    string(port.Protocol),
				})
			}

			var redirect *OptionRedirect
			if item.Redirect != nil {
				redirect = &OptionRedirect{
					To: item.Redirect.To,
					Message: &RedirectMessage{
						Level: string(item.Redirect.Message.Level),
						Text:  item.Redirect.Message.Text,
					},
				}
			}

			imageConfigValues = append(imageConfigValues, ImageConfigValue{
				Id: item.Id,
				Spawner: OptionSpawnerInfo{
					DisplayName: item.Spawner.DisplayName,
					Description: item.Spawner.Description,
					Labels:      labels,
					Hidden:      item.Spawner.Hidden,
				},
				Redirect: redirect,
				Spec: ImageConfigSpec{
					Image:           item.Spec.Image,
					ImagePullPolicy: string(*item.Spec.ImagePullPolicy),
					Ports:           ports,
				},
			})
		}
	}
	return imageConfigValues
}

func BuildPodConfigValues(item *kubefloworgv1beta1.WorkspaceKind) []PodConfigValue {
	podConfigValues := []PodConfigValue{}
	if item.Spec.PodTemplate.Options.PodConfig.Values != nil {
		for _, item := range item.Spec.PodTemplate.Options.PodConfig.Values {
			labels := []OptionSpawnerLabel{}
			for _, label := range item.Spawner.Labels {
				labels = append(labels, OptionSpawnerLabel{
					Key:   label.Key,
					Value: label.Value,
				})
			}

			var redirect *OptionRedirect
			if item.Redirect != nil {
				redirect = &OptionRedirect{
					To: item.Redirect.To,
					Message: &RedirectMessage{
						Level: string(item.Redirect.Message.Level),
						Text:  item.Redirect.Message.Text,
					},
				}
			}

			tolerations := []v1.Toleration{}
			for _, toleration := range item.Spec.Tolerations {
				tolerations = append(tolerations, v1.Toleration{
					Key:      toleration.Key,
					Operator: toleration.Operator,
					Effect:   toleration.Effect,
				})
			}

			podConfigValues = append(podConfigValues, PodConfigValue{
				Id: item.Id,
				Spawner: OptionSpawnerInfo{
					DisplayName: item.Spawner.DisplayName,
					Description: item.Spawner.Description,
					Labels:      labels,
					Hidden:      item.Spawner.Hidden,
				},
				Redirect: redirect,
				Spec: PodConfigSpec{
					Affinity:     item.Spec.Affinity,
					NodeSelector: item.Spec.NodeSelector,
					Tolerations:  tolerations,
				},
			})
		}
	}
	return podConfigValues
}

func NewWorkspaceKindModelFromWorkspaceKind(item *kubefloworgv1beta1.WorkspaceKind) WorkspaceKindModel {
	imageConfigValues := BuildImageConfigValues(item)
	podConfigValues := BuildPodConfigValues(item)

	labels := GetOrDefaultWithRecovery(&item.Spec.PodTemplate.PodMetadata.Labels, make(map[string]string))
	annotations := GetOrDefaultWithRecovery(&item.Spec.PodTemplate.PodMetadata.Annotations, make(map[string]string))

	deprecated := GetOrDefaultWithRecovery(item.Spec.Spawner.Deprecated, false)
	hidden := GetOrDefaultWithRecovery(item.Spec.Spawner.Hidden, false)
	deprecationMessage := GetOrDefaultWithRecovery(item.Spec.Spawner.DeprecationMessage, "")

	icon := map[string]string{"url": GetOrDefaultWithRecovery(item.Spec.Spawner.Icon.Url, "")}
	logo := map[string]string{"url": GetOrDefaultWithRecovery(item.Spec.Spawner.Logo.Url, "")}
	volumeMounts := map[string]string{"home": GetOrDefaultWithRecovery(&item.Spec.PodTemplate.VolumeMounts.Home, "")}

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
