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

package workspaces

import (
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	commonCore "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	commonAssets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	commonWorkspaces "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/common"
)

const (
	UnknownImageConfig = "__UNKNOWN_IMAGE_CONFIG__"
	UnknownPodConfig   = "__UNKNOWN_POD_CONFIG__"
	UnknownIconURL     = "__UNKNOWN_ICON_URL__"
	UnknownLogoURL     = "__UNKNOWN_LOGO_URL__"
)

// NewWorkspaceListItemFromWorkspace creates a WorkspaceListItem model from a Workspace and WorkspaceKind object.
// NOTE: the WorkspaceKind might not exist, so we handle the case where it is nil or has no UID.
func NewWorkspaceListItemFromWorkspace(cfg *config.EnvConfig, ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) WorkspaceListItem {
	commonWorkspaces.EnsureWskMatchesWorkspace(ws, wsk)

	imageConfigModel, imageConfigValue := buildImageConfig(ws, wsk)
	podConfigModel, _ := buildPodConfig(ws, wsk)
	wskPodTemplatePorts := make(map[kubefloworgv1beta1.PortId]kubefloworgv1beta1.WorkspaceKindPort)
	if commonWorkspaces.WskExists(wsk) {
		for _, port := range wsk.Spec.PodTemplate.Ports {
			wskPodTemplatePorts[port.Id] = port
		}
	}

	workspaceModel := WorkspaceListItem{
		Name:        ws.Name,
		DisplayName: ptr.Deref(ws.Spec.DisplayName, ""),
		Namespace:   ws.Namespace,
		WorkspaceKind: WorkspaceKindInfo{
			Name:    ws.Spec.Kind,
			Missing: !commonWorkspaces.WskExists(wsk),
			Icon:    buildIconImageRef(cfg, ws, wsk),
			Logo:    buildLogoImageRef(cfg, ws, wsk),
		},
		Paused:          ptr.Deref(ws.Spec.Paused, false),
		PausedTime:      ws.Status.PauseTime,
		LastRunningTime: ws.Status.LastRunningTime,
		State:           ws.Status.State,
		StateMessage:    ws.Status.StateMessage,
		PodTemplate: PodTemplate{
			Options: PodTemplateOptions{
				ImageConfig: imageConfigModel,
				PodConfig:   podConfigModel,
			},
		},
		Activity: Activity{
			LastActivity: ws.Status.Activity.LastActivity,
			LastUpdate:   ws.Status.Activity.LastUpdate,
			LastProbe:    buildLastProbeInfo(ws.Status.Activity.LastProbe),
			Rules:        buildActivityRules(&ws.Status.Activity),
		},
		Services: buildServices(ws, wskPodTemplatePorts, imageConfigValue),
		Audit:    commonCore.NewAuditFromObjectMeta(&ws.ObjectMeta),
	}
	return workspaceModel
}

func buildImageConfig(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) (ImageConfig, *kubefloworgv1beta1.ImageConfigValue) {
	// create a map of image configs from the WorkspaceKind for easy lookup by ID
	// NOTE: we can only build this map if the WorkspaceKind exists, otherwise it will be empty
	imageConfigMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	if commonWorkspaces.WskExists(wsk) {
		imageConfigMap = make(map[string]kubefloworgv1beta1.ImageConfigValue, len(wsk.Spec.PodTemplate.Options.ImageConfig.Values))
		for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
			imageConfigMap[value.Id] = value
		}
	}

	// get the current image config
	var currentImageConfigValue *kubefloworgv1beta1.ImageConfigValue
	var currentSpawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo
	currentImageConfigId := ws.Spec.PodTemplate.Options.ImageConfig
	if cfg, ok := imageConfigMap[currentImageConfigId]; ok {
		currentImageConfigValue = &cfg
		currentSpawnerInfo = &cfg.Spawner
	}
	currentImageConfig := buildOptionInfo(currentImageConfigId, UnknownImageConfig, currentSpawnerInfo)

	// build the redirect chain
	// NOTE: the redirect chain will be nil (not an empty slice) if there are no redirects
	var redirectChain []RedirectStep
	numRedirects := len(ws.Status.PodTemplateOptions.ImageConfig.RedirectChain)
	if numRedirects > 0 {
		redirectChain = make([]RedirectStep, numRedirects)
	}
	for i := range ws.Status.PodTemplateOptions.ImageConfig.RedirectChain {
		step := ws.Status.PodTemplateOptions.ImageConfig.RedirectChain[i]

		var sourceSpawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo
		if cfg, ok := imageConfigMap[step.Source]; ok {
			sourceSpawnerInfo = &cfg.Spawner
		}
		var targetSpawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo
		if cfg, ok := imageConfigMap[step.Target]; ok {
			targetSpawnerInfo = &cfg.Spawner
		}

		redirectChain[i] = RedirectStep{
			Source: buildOptionInfo(step.Source, UnknownImageConfig, sourceSpawnerInfo),
			Target: buildOptionInfo(step.Target, UnknownImageConfig, targetSpawnerInfo),
		}
		if cfg, ok := imageConfigMap[step.Source]; ok {
			// skip the redirect if it's not the target we expect
			if cfg.Redirect != nil && cfg.Redirect.To == step.Target {
				redirectChain[i].Message = buildRedirectMessage(cfg.Redirect.Message)
			}
		}
	}

	return ImageConfig{
		Current:       currentImageConfig,
		RedirectChain: redirectChain,
	}, currentImageConfigValue
}

func buildPodConfig(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) (PodConfig, *kubefloworgv1beta1.PodConfigValue) {
	// create a map of pod configs from the WorkspaceKind for easy lookup by ID
	// NOTE: we can only build this map if the WorkspaceKind exists, otherwise it will be empty
	podConfigMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	if commonWorkspaces.WskExists(wsk) {
		podConfigMap = make(map[string]kubefloworgv1beta1.PodConfigValue, len(wsk.Spec.PodTemplate.Options.PodConfig.Values))
		for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
			podConfigMap[value.Id] = value
		}
	}

	// get the current pod config
	var currentPodConfigValue *kubefloworgv1beta1.PodConfigValue
	var currentSpawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo
	currentPodConfigId := ws.Spec.PodTemplate.Options.PodConfig
	if cfg, ok := podConfigMap[currentPodConfigId]; ok {
		currentPodConfigValue = &cfg
		currentSpawnerInfo = &cfg.Spawner
	}
	currentPodConfig := buildOptionInfo(currentPodConfigId, UnknownPodConfig, currentSpawnerInfo)

	// build the redirect chain
	// NOTE: the redirect chain will be nil (not an empty slice) if there are no redirects
	var redirectChain []RedirectStep
	numRedirects := len(ws.Status.PodTemplateOptions.PodConfig.RedirectChain)
	if numRedirects > 0 {
		redirectChain = make([]RedirectStep, numRedirects)
	}
	for i := range ws.Status.PodTemplateOptions.PodConfig.RedirectChain {
		step := ws.Status.PodTemplateOptions.PodConfig.RedirectChain[i]

		var sourceSpawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo
		if cfg, ok := podConfigMap[step.Source]; ok {
			sourceSpawnerInfo = &cfg.Spawner
		}
		var targetSpawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo
		if cfg, ok := podConfigMap[step.Target]; ok {
			targetSpawnerInfo = &cfg.Spawner
		}

		redirectChain[i] = RedirectStep{
			Source: buildOptionInfo(step.Source, UnknownPodConfig, sourceSpawnerInfo),
			Target: buildOptionInfo(step.Target, UnknownPodConfig, targetSpawnerInfo),
		}
		if cfg, ok := podConfigMap[step.Source]; ok {
			// skip the redirect if it's not the target we expect
			if cfg.Redirect != nil && cfg.Redirect.To == step.Target {
				redirectChain[i].Message = buildRedirectMessage(cfg.Redirect.Message)
			}
		}
	}

	return PodConfig{
		Current:       currentPodConfig,
		RedirectChain: redirectChain,
	}, currentPodConfigValue
}

func buildOptionInfo(id string, unknownFallback string, spawnerInfo *kubefloworgv1beta1.OptionSpawnerInfo) OptionInfo {
	if spawnerInfo != nil {
		return OptionInfo{
			Id:          id,
			DisplayName: spawnerInfo.DisplayName,
			Description: ptr.Deref(spawnerInfo.Description, ""),
			Labels:      buildOptionLabels(spawnerInfo.Labels),
		}
	}
	return OptionInfo{
		Id:          id,
		DisplayName: unknownFallback,
		Description: unknownFallback,
		Labels:      nil,
	}
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

func buildRedirectMessage(msg *kubefloworgv1beta1.RedirectMessage) *RedirectMessage {
	if msg == nil {
		return nil
	}

	messageLevel := RedirectMessageLevelInfo
	switch msg.Level {
	case kubefloworgv1beta1.RedirectMessageLevelInfo:
		messageLevel = RedirectMessageLevelInfo
	case kubefloworgv1beta1.RedirectMessageLevelWarning:
		messageLevel = RedirectMessageLevelWarning
	case kubefloworgv1beta1.RedirectMessageLevelDanger:
		messageLevel = RedirectMessageLevelDanger
	}

	return &RedirectMessage{
		Text:  msg.Text,
		Level: messageLevel,
	}
}

func buildServices(ws *kubefloworgv1beta1.Workspace, wskPodTemplatePorts map[kubefloworgv1beta1.PortId]kubefloworgv1beta1.WorkspaceKindPort, imageConfigValue *kubefloworgv1beta1.ImageConfigValue) []Service {
	if imageConfigValue == nil {
		return nil
	}

	services := make([]Service, len(imageConfigValue.Spec.Ports))
	for i := range imageConfigValue.Spec.Ports {
		port := imageConfigValue.Spec.Ports[i]

		// Check if the port ID exists in the workspace kind
		wskPort, exists := wskPodTemplatePorts[port.Id]
		if !exists {
			panic(fmt.Sprintf("workspace portID \"%q\" does not exist in the workspace kind", port.Id))
		}

		protocol := wskPort.Protocol
		// golint complains about the single case in switch statement
		switch protocol { //nolint:gocritic
		case kubefloworgv1beta1.ImagePortProtocolHTTP:
			services[i].HttpService = &HttpService{
				DisplayName: ptr.Deref(port.DisplayName, wskPort.DefaultDisplayName),
				HttpPath:    fmt.Sprintf("/workspace/connect/%s/%s/%s/", ws.Namespace, ws.Name, port.Id),
			}
		}
	}

	return services
}

// buildIconImageRef creates an ImageRef from the icon asset of a WorkspaceKind.
func buildIconImageRef(cfg *config.EnvConfig, ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) commonAssets.ImageRef {
	if !commonWorkspaces.WskExists(wsk) {
		return commonAssets.ImageRef{URL: UnknownIconURL}
	}
	return commonAssets.NewImageRefFromWorkspaceKindAssetIcon(cfg, wsk.Spec.Spawner.Icon, wsk.Status.SpawnerIcon, ws.Spec.Kind)
}

// buildLogoImageRef creates an ImageRef from the logo asset of a WorkspaceKind.
func buildLogoImageRef(cfg *config.EnvConfig, ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) commonAssets.ImageRef {
	if !commonWorkspaces.WskExists(wsk) {
		return commonAssets.ImageRef{URL: UnknownLogoURL}
	}
	return commonAssets.NewImageRefFromWorkspaceKindAssetLogo(cfg, wsk.Spec.Spawner.Logo, wsk.Status.SpawnerLogo, ws.Spec.Kind)
}

func buildLastProbeInfo(probe *kubefloworgv1beta1.WorkspaceActivityLastProbe) *LastProbeInfo {
	if probe == nil {
		return nil
	}

	result := ProbeResult(probe.Result)
	switch probe.Result {
	case kubefloworgv1beta1.WorkspaceProbeResultSuccess:
		result = ProbeResultSuccess
	case kubefloworgv1beta1.WorkspaceProbeResultFailure:
		result = ProbeResultFailure
	case kubefloworgv1beta1.WorkspaceProbeResultTimeout:
		result = ProbeResultTimeout
	}

	return &LastProbeInfo{
		StartTime: probe.StartTime,
		EndTime:   probe.EndTime,
		Result:    result,
		Message:   probe.Message,
	}
}

func buildActivityRules(activity *kubefloworgv1beta1.WorkspaceActivity) *ActivityRules {
	if activity == nil || activity.Rules == nil {
		return nil
	}
	var pauseRule *ActivityPauseRule
	if activity.Rules.PauseWorkspace != nil {
		pauseRule = &ActivityPauseRule{
			EligibleAfter: activity.Rules.PauseWorkspace.EligibleAfter,
		}
	}
	if pauseRule == nil {
		return nil
	}
	return &ActivityRules{
		PauseWorkspace: pauseRule,
	}
}
