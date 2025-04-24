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
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"
)

// NewWorkspaceKindModelFromWorkspaceKind creates a WorkspaceKind model from a WorkspaceKind object.
func NewWorkspaceKindModelFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind) WorkspaceKind {
	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if wsk.Spec.PodTemplate.PodMetadata != nil {
		// NOTE: we copy the maps to avoid creating a reference to the original maps.
		for k, v := range wsk.Spec.PodTemplate.PodMetadata.Labels {
			podLabels[k] = v
		}
		for k, v := range wsk.Spec.PodTemplate.PodMetadata.Annotations {
			podAnnotations[k] = v
		}
	}

	// TODO: icons can either be a remote URL or read from a ConfigMap.
	//       in BOTH cases, we should cache and serve the image under a path on the backend API:
	//       /api/v1/workspacekinds/{name}/assets/icon
	iconRef := ImageRef{
		URL: fmt.Sprintf("/workspaces/backend/api/v1/workspacekinds/%s/assets/icon", wsk.Name),
	}

	// TODO: logos can either be a remote URL or read from a ConfigMap.
	//       in BOTH cases, we should cache and serve the image under a path on the backend API:
	//       /api/v1/workspacekinds/{name}/assets/logo
	logoRef := ImageRef{
		URL: fmt.Sprintf("/workspaces/backend/api/v1/workspacekinds/%s/assets/logo", wsk.Name),
	}

	return WorkspaceKind{
		Name:               wsk.Name,
		DisplayName:        wsk.Spec.Spawner.DisplayName,
		Description:        wsk.Spec.Spawner.Description,
		Deprecated:         ptr.Deref(wsk.Spec.Spawner.Deprecated, false),
		DeprecationMessage: ptr.Deref(wsk.Spec.Spawner.DeprecationMessage, ""),
		Hidden:             ptr.Deref(wsk.Spec.Spawner.Hidden, false),
		Icon:               iconRef,
		Logo:               logoRef,
		PodTemplate: PodTemplate{
			PodMetadata: PodMetadata{
				Labels:      podLabels,
				Annotations: podAnnotations,
			},
			VolumeMounts: PodVolumeMounts{
				Home: wsk.Spec.PodTemplate.VolumeMounts.Home,
			},
			Options: PodTemplateOptions{
				ImageConfig: ImageConfig{
					Default: wsk.Spec.PodTemplate.Options.ImageConfig.Spawner.Default,
					Values:  buildImageConfigValues(wsk.Spec.PodTemplate.Options.ImageConfig),
				},
				PodConfig: PodConfig{
					Default: wsk.Spec.PodTemplate.Options.PodConfig.Spawner.Default,
					Values:  buildPodConfigValues(wsk.Spec.PodTemplate.Options.PodConfig),
				},
			},
		},
	}
}

func buildImageConfigValues(imageConfig kubefloworgv1beta1.ImageConfig) []ImageConfigValue {
	imageConfigValues := make([]ImageConfigValue, len(imageConfig.Values))
	for i := range imageConfig.Values {
		option := imageConfig.Values[i]
		imageConfigValues[i] = ImageConfigValue{
			Id:          option.Id,
			DisplayName: option.Spawner.DisplayName,
			Description: ptr.Deref(option.Spawner.Description, ""),
			Labels:      buildOptionLabels(option.Spawner.Labels),
			Hidden:      ptr.Deref(option.Spawner.Hidden, false),
			Redirect:    buildOptionRedirect(option.Redirect),
		}
	}
	return imageConfigValues
}

func buildPodConfigValues(podConfig kubefloworgv1beta1.PodConfig) []PodConfigValue {
	podConfigValues := make([]PodConfigValue, len(podConfig.Values))
	for i := range podConfig.Values {
		option := podConfig.Values[i]
		podConfigValues[i] = PodConfigValue{
			Id:          option.Id,
			DisplayName: option.Spawner.DisplayName,
			Description: ptr.Deref(option.Spawner.Description, ""),
			Labels:      buildOptionLabels(option.Spawner.Labels),
			Hidden:      ptr.Deref(option.Spawner.Hidden, false),
			Redirect:    buildOptionRedirect(option.Redirect),
		}
	}
	return podConfigValues
}

func buildOptionLabels(labels []kubefloworgv1beta1.OptionSpawnerLabel) []OptionLabel {
	optionLabels := make([]OptionLabel, len(labels))
	for i := range labels {
		optionLabels[i] = OptionLabel{
			Key:   labels[i].Key,
			Value: labels[i].Value,
		}
	}
	return optionLabels
}

func buildOptionRedirect(redirect *kubefloworgv1beta1.OptionRedirect) *OptionRedirect {
	if redirect == nil {
		return nil
	}

	var message *RedirectMessage
	if redirect.Message != nil {
		messageLevel := RedirectMessageLevelInfo
		switch redirect.Message.Level {
		case kubefloworgv1beta1.RedirectMessageLevelInfo:
			messageLevel = RedirectMessageLevelInfo
		case kubefloworgv1beta1.RedirectMessageLevelWarning:
			messageLevel = RedirectMessageLevelWarning
		case kubefloworgv1beta1.RedirectMessageLevelDanger:
			messageLevel = RedirectMessageLevelDanger
		}

		message = &RedirectMessage{
			Text:  redirect.Message.Text,
			Level: messageLevel,
		}
	}

	return &OptionRedirect{
		To:      redirect.To,
		Message: message,
	}
}
