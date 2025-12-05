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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
)

// NewWorkspaceKindModelFromWorkspaceKind creates a WorkspaceKind model from a WorkspaceKind object.
// This is a convenience function that calls NewWorkspaceKindModelFromWorkspaceKindWithAssetContext with nil WorkspaceKindAssetContext.
// For cases where asset information is available (e.g., ConfigMap-based assets), use NewWorkspaceKindModelFromWorkspaceKindWithAssetContext instead.
func NewWorkspaceKindModelFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind) WorkspaceKind {
	return NewWorkspaceKindModelFromWorkspaceKindWithAssetContext(wsk, nil)
}

// NewWorkspaceKindModelFromWorkspaceKindWithAssetContext creates a WorkspaceKind model from a WorkspaceKind object.
// assetCtx contains metadata about icon and logo assets (SHA256 hashes and errors).
// If nil, assets will be built without hash or error information.
// SHA256 hashes will be appended as query parameters to ConfigMap-based asset URLs.
// Errors will be set in ImageRef.Error when ConfigMap retrieval fails.
func NewWorkspaceKindModelFromWorkspaceKindWithAssetContext(wsk *kubefloworgv1beta1.WorkspaceKind, assetCtx *assets.WorkspaceKindAssetContext) WorkspaceKind {
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
	statusImageConfigMap := buildOptionMetricsMap(wsk.Status.PodTemplateOptions.ImageConfig)
	statusPodConfigMap := buildOptionMetricsMap(wsk.Status.PodTemplateOptions.PodConfig)

	var iconInfo assets.WorkspaceKindAssetDetails
	var logoInfo assets.WorkspaceKindAssetDetails
	if assetCtx != nil {
		iconInfo = assetCtx.Icon
		logoInfo = assetCtx.Logo
	} else {
		// Create empty AssetInfo with types set when WorkspaceKindAssetContext is nil
		iconInfo = assets.NewIconAssetInfo("", nil)
		logoInfo = assets.NewLogoAssetInfo("", nil)
	}
	iconRef := buildIconImageRef(wsk, iconInfo)
	logoRef := buildLogoImageRef(wsk, logoInfo)

	return WorkspaceKind{
		Name:               wsk.Name,
		DisplayName:        wsk.Spec.Spawner.DisplayName,
		Description:        wsk.Spec.Spawner.Description,
		Deprecated:         ptr.Deref(wsk.Spec.Spawner.Deprecated, false),
		DeprecationMessage: ptr.Deref(wsk.Spec.Spawner.DeprecationMessage, ""),
		Hidden:             ptr.Deref(wsk.Spec.Spawner.Hidden, false),
		Icon:               iconRef,
		Logo:               logoRef,
		// TODO: in the future will need to support including exactly one of clusterMetrics or namespaceMetrics based on request context
		ClusterMetrics: clusterMetrics{
			Workspaces: wsk.Status.Workspaces,
		},
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
					Values:  buildImageConfigValues(wsk.Spec.PodTemplate.Options.ImageConfig, statusImageConfigMap),
				},
				PodConfig: PodConfig{
					Default: wsk.Spec.PodTemplate.Options.PodConfig.Spawner.Default,
					Values:  buildPodConfigValues(wsk.Spec.PodTemplate.Options.PodConfig, statusPodConfigMap),
				},
			},
		},
	}
}

func buildOptionMetricsMap(metrics []kubefloworgv1beta1.OptionMetric) map[string]int32 {
	resultMap := make(map[string]int32)
	for _, metric := range metrics {
		resultMap[metric.Id] = metric.Workspaces
	}
	return resultMap
}

func buildImageConfigValues(imageConfig kubefloworgv1beta1.ImageConfig, statusImageConfigMap map[string]int32) []ImageConfigValue {
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
			// TODO: in the future will need to support including exactly one of clusterMetrics or namespaceMetrics based on request context
			ClusterMetrics: clusterMetrics{
				Workspaces: statusImageConfigMap[option.Id],
			},
		}
	}
	return imageConfigValues
}

func buildPodConfigValues(podConfig kubefloworgv1beta1.PodConfig, statusPodConfigMap map[string]int32) []PodConfigValue {
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
			// TODO: in the future will need to support including exactly one of clusterMetrics or namespaceMetrics based on request context
			ClusterMetrics: clusterMetrics{
				Workspaces: statusPodConfigMap[option.Id],
			},
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

// buildIconImageRef creates an ImageRef from the icon asset of a WorkspaceKind.
func buildIconImageRef(wsk *kubefloworgv1beta1.WorkspaceKind, iconInfo assets.WorkspaceKindAssetDetails) assets.ImageRef {
	return assets.BuildImageRef(wsk.Spec.Spawner.Icon, wsk.Name, iconInfo)
}

// buildLogoImageRef creates an ImageRef from the logo asset of a WorkspaceKind.
func buildLogoImageRef(wsk *kubefloworgv1beta1.WorkspaceKind, logoInfo assets.WorkspaceKindAssetDetails) assets.ImageRef {
	return assets.BuildImageRef(wsk.Spec.Spawner.Logo, wsk.Name, logoInfo)
}
