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
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

func NewPodTemplateOptionsModelFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind, request *ListValuesRequest) (*PodTemplateOptions, error) {
	var allValErrs field.ErrorList

	// calculate maps of "option id" -> "number of workspaces using that option in the cluster"
	metricsMapImageConfig := calculateOptionMetricsMap(wsk.Status.PodTemplateOptions.ImageConfig)
	metricsMapPodConfig := calculateOptionMetricsMap(wsk.Status.PodTemplateOptions.PodConfig)

	// accumulate image config values
	imageConfigValues, valErrs := buildImageConfigValues(wsk, request, metricsMapImageConfig)
	allValErrs = append(allValErrs, valErrs...)

	// accumulate pod config values
	podConfigValues, valErrs := buildPodConfigValues(wsk, request, metricsMapPodConfig)
	allValErrs = append(allValErrs, valErrs...)

	// if there are any validation errors, return an aggregated error
	if len(allValErrs) > 0 {
		return nil, helper.NewInternalValidationError(allValErrs)
	}

	return &PodTemplateOptions{
		ImageConfig: ImageConfig{
			Default: wsk.Spec.PodTemplate.Options.ImageConfig.Spawner.Default,
			Values:  imageConfigValues,
		},
		PodConfig: PodConfig{
			Default: wsk.Spec.PodTemplate.Options.PodConfig.Spawner.Default,
			Values:  podConfigValues,
		},
	}, nil

}

func calculateOptionMetricsMap(metrics []kubefloworgv1beta1.OptionMetric) map[string]int32 {
	resultMap := make(map[string]int32, len(metrics))
	for _, metric := range metrics {
		resultMap[metric.Id] = metric.Workspaces
	}
	return resultMap
}

func buildImageConfigValues(wsk *kubefloworgv1beta1.WorkspaceKind, request *ListValuesRequest, optionMetricsMap map[string]int32) ([]ImageConfigValue, field.ErrorList) {
	var valErrs field.ErrorList

	// get the id of any IMAGE CONFIG value specified in the context
	var requestContextImageConfigId string
	if request.Context.ImageConfig != nil {
		requestContextImageConfigId = request.Context.ImageConfig.Id
	}

	// when the context has an IMAGE CONFIG value, we ONLY include THAT value in the list and ignore the rest.
	// otherwise we include ALL values in the list (subject to any filtering by rules).
	estimatedReturnLength := 1
	if requestContextImageConfigId != "" {
		estimatedReturnLength = len(wsk.Spec.PodTemplate.Options.ImageConfig.Values)
	}

	// populate the list of image config values to return
	foundContextValue := false
	imageConfigValues := make([]ImageConfigValue, 0, estimatedReturnLength)
	for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
		if requestContextImageConfigId != "" {
			if value.Id == requestContextImageConfigId {
				foundContextValue = true
			} else {
				// skip this value since it doesn't match the context value id
				continue
			}
		}
		imageConfigValues = append(imageConfigValues, ImageConfigValue{
			Id:          value.Id,
			DisplayName: value.Spawner.DisplayName,
			Description: ptr.Deref(value.Spawner.Description, ""),
			Labels:      buildOptionLabels(value.Spawner.Labels),
			//
			// TODO: merge with effect of any matching rules that have `effect.ui.hide`, once WSK rules exist
			//
			Hidden:         ptr.Deref(value.Spawner.Hidden, false),
			Redirect:       buildOptionRedirect(value.Redirect),
			ClusterMetrics: buildClusterOptionMetrics(value.Id, optionMetricsMap),
		})
	}

	// return a validation error if the context specified an image config not found in the workspace kind
	if requestContextImageConfigId != "" && !foundContextValue {
		imageConfigIdPath := field.NewPath("context").Child("imageConfig").Child("id")
		errDetail := fmt.Sprintf("provided image config id %q not found in workspace kind %q", requestContextImageConfigId, wsk.Name)
		valErrs = append(valErrs, field.Invalid(imageConfigIdPath, requestContextImageConfigId, errDetail))
	}

	return imageConfigValues, valErrs
}

func buildPodConfigValues(wsk *kubefloworgv1beta1.WorkspaceKind, request *ListValuesRequest, optionMetricsMap map[string]int32) ([]PodConfigValue, field.ErrorList) {
	var valErrs field.ErrorList

	// get the id of any POD CONFIG value specified in the context
	var requestContextPodConfigId string
	if request.Context.PodConfig != nil {
		requestContextPodConfigId = request.Context.PodConfig.Id
	}

	// when the context has a POD CONFIG value, we ONLY include THAT value in the list and ignore the rest.
	// otherwise we include ALL values in the list (subject to any filtering by rules).
	estimatedReturnLength := 1
	if requestContextPodConfigId != "" {
		estimatedReturnLength = len(wsk.Spec.PodTemplate.Options.PodConfig.Values)
	}

	// populate the list of pod config values to return
	foundContextValue := false
	podConfigValues := make([]PodConfigValue, 0, estimatedReturnLength)
	for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
		if requestContextPodConfigId != "" {
			if value.Id == requestContextPodConfigId {
				foundContextValue = true
			} else {
				// skip this value since it doesn't match the context value id
				continue
			}
		}
		podConfigValues = append(podConfigValues, PodConfigValue{
			Id:          value.Id,
			DisplayName: value.Spawner.DisplayName,
			Description: ptr.Deref(value.Spawner.Description, ""),
			Labels:      buildOptionLabels(value.Spawner.Labels),
			//
			// TODO: merge with effect of any matching rules that have `effect.ui.hide`, once WSK rules exist
			//
			Hidden:         ptr.Deref(value.Spawner.Hidden, false),
			Redirect:       buildOptionRedirect(value.Redirect),
			ClusterMetrics: buildClusterOptionMetrics(value.Id, optionMetricsMap),
		})
	}

	// return a validation error if the context specified a pod config not found in the workspace kind
	if requestContextPodConfigId != "" && !foundContextValue {
		podConfigIdPath := field.NewPath("context").Child("podConfig").Child("id")
		errDetail := fmt.Sprintf("provided pod config id %q not found in workspace kind %q", requestContextPodConfigId, wsk.Name)
		valErrs = append(valErrs, field.Invalid(podConfigIdPath, requestContextPodConfigId, errDetail))
	}

	return podConfigValues, valErrs
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

func buildClusterOptionMetrics(optionId string, optionMetricsMap map[string]int32) ClusterOptionMetrics {
	optionMetrics := ClusterOptionMetrics{}

	if workspacesCount, ok := optionMetricsMap[optionId]; ok {
		optionMetrics.Workspaces = workspacesCount
	}

	return optionMetrics
}
