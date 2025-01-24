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
)

const (
	UnknownHomeMountPath = "__UNKNOWN_HOME_MOUNT_PATH__"
	UnknownImageConfig   = "__UNKNOWN_IMAGE_CONFIG__"
	UnknownPodConfig     = "__UNKNOWN_POD_CONFIG__"
)

// NewWorkspaceModelFromWorkspace creates a Workspace model from a Workspace and WorkspaceKind object.
// NOTE: the WorkspaceKind might not exist, so we handle the case where it is nil or has no UID.
func NewWorkspaceModelFromWorkspace(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) Workspace {
	// ensure the provided WorkspaceKind matches the Workspace
	if wskExists(wsk) && ws.Spec.Kind != wsk.Name {
		panic("provided WorkspaceKind does not match the Workspace")
	}

	// TODO: icons can either be a remote URL or read from a ConfigMap.
	//       in BOTH cases, we should cache and serve the image under a path on the backend API:
	//       /api/v1/workspacekinds/{name}/assets/icon
	iconRef := ImageRef{
		URL: fmt.Sprintf("/workspaces/backend/api/v1/workspacekinds/%s/assets/icon", ws.Spec.Kind),
	}

	// TODO: logos can either be a remote URL or read from a ConfigMap.
	//       in BOTH cases, we should cache and serve the image under a path on the backend API:
	//       /api/v1/workspacekinds/{name}/assets/logo
	logoRef := ImageRef{
		URL: fmt.Sprintf("/workspaces/backend/api/v1/workspacekinds/%s/assets/logo", ws.Spec.Kind),
	}

	wsState := WorkspaceStateUnknown
	switch ws.Status.State {
	case kubefloworgv1beta1.WorkspaceStateRunning:
		wsState = WorkspaceStateRunning
	case kubefloworgv1beta1.WorkspaceStateTerminating:
		wsState = WorkspaceStateTerminating
	case kubefloworgv1beta1.WorkspaceStatePaused:
		wsState = WorkspaceStatePaused
	case kubefloworgv1beta1.WorkspaceStatePending:
		wsState = WorkspaceStatePending
	case kubefloworgv1beta1.WorkspaceStateError:
		wsState = WorkspaceStateError
	case kubefloworgv1beta1.WorkspaceStateUnknown:
		wsState = WorkspaceStateUnknown
	}

	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if ws.Spec.PodTemplate.PodMetadata != nil {
		// NOTE: we copy the maps to avoid creating a reference to the original maps.
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Labels {
			podLabels[k] = v
		}
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Annotations {
			podAnnotations[k] = v
		}
	}

	dataVolumes := make([]PodVolumeInfo, len(ws.Spec.PodTemplate.Volumes.Data))
	for i := range ws.Spec.PodTemplate.Volumes.Data {
		volume := ws.Spec.PodTemplate.Volumes.Data[i]
		readOnly := false
		if volume.ReadOnly != nil {
			readOnly = *volume.ReadOnly
		}
		dataVolumes[i] = PodVolumeInfo{
			PvcName:   volume.PVCName,
			MountPath: volume.MountPath,
			ReadOnly:  readOnly,
		}
	}

	workspaceModel := Workspace{
		Name:      ws.Name,
		Namespace: ws.Namespace,
		WorkspaceKind: WorkspaceKindInfo{
			Name:    ws.Spec.Kind,
			Missing: !wskExists(wsk),
			Icon:    iconRef,
			Logo:    logoRef,
		},
		DeferUpdates: ptr.Deref(ws.Spec.DeferUpdates, false),
		Paused:       ptr.Deref(ws.Spec.Paused, false),
		PausedTime:   ws.Status.PauseTime,
		State:        wsState,
		StateMessage: ws.Status.StateMessage,
		PodTemplate: PodTemplate{
			PodMetadata: PodMetadata{
				Labels:      podLabels,
				Annotations: podAnnotations,
			},
			Volumes: PodVolumes{
				Home: buildHomeVolume(ws, wsk),
				Data: dataVolumes,
			},
			Options: PodTemplateOptions{
				ImageConfig: buildImageConfig(ws, wsk),
				PodConfig:   buildPodConfig(ws, wsk),
			},
		},
		Activity: Activity{
			LastActivity: ws.Status.Activity.LastActivity,
			LastUpdate:   ws.Status.Activity.LastUpdate,
			// TODO: populate LastProbe when culling is implemented:
			//       https://github.com/kubeflow/notebooks/issues/38
			LastProbe: nil,
		},
	}
	return workspaceModel
}

func wskExists(wsk *kubefloworgv1beta1.WorkspaceKind) bool {
	return wsk != nil && wsk.UID != ""
}

func buildHomeVolume(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) *PodVolumeInfo {
	if ws.Spec.PodTemplate.Volumes.Home == nil {
		return nil
	}

	// we only know the mount path if the WorkspaceKind exists
	homeMountPath := UnknownHomeMountPath
	if wskExists(wsk) {
		homeMountPath = wsk.Spec.PodTemplate.VolumeMounts.Home
	}

	return &PodVolumeInfo{
		PvcName:   *ws.Spec.PodTemplate.Volumes.Home,
		MountPath: homeMountPath,
		// the home volume is ~always~ read-write
		ReadOnly: false,
	}
}

func buildImageConfig(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) ImageConfig {
	// create a map of image configs from the WorkspaceKind for easy lookup by ID
	// NOTE: we can only build this map if the WorkspaceKind exists, otherwise it will be empty
	imageConfigMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	if wskExists(wsk) {
		imageConfigMap = make(map[string]kubefloworgv1beta1.ImageConfigValue, len(wsk.Spec.PodTemplate.Options.ImageConfig.Values))
		for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
			imageConfigMap[value.Id] = value
		}
	}

	// get the current image config
	currentImageConfig := OptionInfo{
		Id:          ws.Spec.PodTemplate.Options.ImageConfig,
		DisplayName: UnknownImageConfig,
		Description: UnknownImageConfig,
		Labels:      nil,
	}
	if cfg, ok := imageConfigMap[currentImageConfig.Id]; ok {
		currentImageConfig.DisplayName = cfg.Spawner.DisplayName
		currentImageConfig.Description = ptr.Deref(cfg.Spawner.Description, "")
		currentImageConfig.Labels = buildOptionLabels(cfg.Spawner.Labels)
	}

	// get the desired image config
	// NOTE: the desired image config will be nil if it is the same as the current image config
	var desiredImageConfig *OptionInfo
	desiredImageConfigId := ws.Status.PodTemplateOptions.ImageConfig.Desired
	if desiredImageConfigId != "" && desiredImageConfigId != currentImageConfig.Id {
		desiredImageConfig = &OptionInfo{
			Id:          desiredImageConfigId,
			DisplayName: UnknownImageConfig,
			Description: UnknownImageConfig,
			Labels:      nil,
		}
		if cfg, ok := imageConfigMap[desiredImageConfig.Id]; ok {
			desiredImageConfig.DisplayName = cfg.Spawner.DisplayName
			desiredImageConfig.Description = ptr.Deref(cfg.Spawner.Description, "")
			desiredImageConfig.Labels = buildOptionLabels(cfg.Spawner.Labels)
		}
	}

	// build the redirect chain
	// NOTE: the redirect chain will be nil (not an empty slice) if there are no redirects
	var redirectChain []RedirectStep
	numRedirects := len(ws.Status.PodTemplateOptions.ImageConfig.RedirectChain)
	if numRedirects > 0 {
		redirectChain = make([]RedirectStep, numRedirects)
	}
	for i := range ws.Status.PodTemplateOptions.ImageConfig.RedirectChain {
		step := ws.Status.PodTemplateOptions.ImageConfig.RedirectChain[i]
		redirectChain[i] = RedirectStep{
			SourceId: step.Source,
			TargetId: step.Target,
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
		Desired:       desiredImageConfig,
		RedirectChain: redirectChain,
	}
}

func buildPodConfig(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) PodConfig {
	// create a map of pod configs from the WorkspaceKind for easy lookup by ID
	// NOTE: we can only build this map if the WorkspaceKind exists, otherwise it will be empty
	podConfigMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	if wskExists(wsk) {
		podConfigMap = make(map[string]kubefloworgv1beta1.PodConfigValue, len(wsk.Spec.PodTemplate.Options.PodConfig.Values))
		for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
			podConfigMap[value.Id] = value
		}
	}

	// get the current pod config
	currentPodConfig := OptionInfo{
		Id:          ws.Spec.PodTemplate.Options.PodConfig,
		DisplayName: UnknownPodConfig,
		Description: UnknownPodConfig,
		Labels:      nil,
	}
	if cfg, ok := podConfigMap[currentPodConfig.Id]; ok {
		currentPodConfig.DisplayName = cfg.Spawner.DisplayName
		currentPodConfig.Description = ptr.Deref(cfg.Spawner.Description, "")
		currentPodConfig.Labels = buildOptionLabels(cfg.Spawner.Labels)
	}

	// get the desired pod config
	// NOTE: the desired pod config will be nil if it is the same as the current pod config
	var desiredPodConfig *OptionInfo
	desiredPodConfigId := ws.Status.PodTemplateOptions.PodConfig.Desired
	if desiredPodConfigId != "" && desiredPodConfigId != currentPodConfig.Id {
		desiredPodConfig = &OptionInfo{
			Id:          desiredPodConfigId,
			DisplayName: UnknownPodConfig,
			Description: UnknownPodConfig,
			Labels:      nil,
		}
		if cfg, ok := podConfigMap[desiredPodConfig.Id]; ok {
			desiredPodConfig.DisplayName = cfg.Spawner.DisplayName
			desiredPodConfig.Description = ptr.Deref(cfg.Spawner.Description, "")
			desiredPodConfig.Labels = buildOptionLabels(cfg.Spawner.Labels)
		}
	}

	// build the redirect chain
	// NOTE: the redirect chain will be nil (not an empty slice) if there are no redirects
	var redirectChain []RedirectStep
	numRedirects := len(ws.Status.PodTemplateOptions.PodConfig.RedirectChain)
	if numRedirects > 0 {
		redirectChain = make([]RedirectStep, numRedirects)
	}
	for i := range ws.Status.PodTemplateOptions.PodConfig.RedirectChain {
		step := ws.Status.PodTemplateOptions.PodConfig.RedirectChain[i]
		redirectChain[i] = RedirectStep{
			SourceId: step.Source,
			TargetId: step.Target,
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
		Desired:       desiredPodConfig,
		RedirectChain: redirectChain,
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
