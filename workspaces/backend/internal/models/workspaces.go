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
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

type WorkspaceModel struct {
	Namespace    string            `json:"namespace"`
	Name         string            `json:"name"`
	Paused       bool              `json:"paused"`
	DeferUpdates bool              `json:"defer_updates"`
	Kind         string            `json:"kind"`
	ImageConfig  string            `json:"image_config"`
	PodConfig    string            `json:"pod_config"`
	HomeVolume   string            `json:"home_volume"`
	DataVolumes  []DataVolumeModel `json:"data_volumes"`
	Labels       map[string]string `json:"labels,omitempty"`
	Annotations  map[string]string `json:"annotations,omitempty"`
	Status       string            `json:"status"`
	LastActivity string            `json:"last_activity"`
}

type DataVolumeModel struct {
	PvcName   string `json:"pvc_name"`
	MountPath string `json:"mount_path"`
	ReadOnly  bool   `json:"read_only"`
}

func NewWorkspaceModelFromWorkspace(item *kubefloworgv1beta1.Workspace) WorkspaceModel {
	t := time.Unix(item.Status.Activity.LastActivity, 0)
	formattedLastActivity := t.Format("2006-01-02 15:04:05 MST")

	dataVolumes := make([]DataVolumeModel, len(item.Spec.PodTemplate.Volumes.Data))
	for i, volume := range item.Spec.PodTemplate.Volumes.Data {
		dataVolumes[i] = DataVolumeModel{
			PvcName:   volume.PVCName,
			MountPath: volume.MountPath,
			ReadOnly:  *volume.ReadOnly,
		}
	}
	// TODO: review all fields
	workspaceModel := WorkspaceModel{
		Namespace:    item.Namespace,
		Name:         item.ObjectMeta.Name,
		Paused:       *item.Spec.Paused,
		DeferUpdates: *item.Spec.DeferUpdates,
		Kind:         item.Spec.Kind,
		ImageConfig:  item.Spec.PodTemplate.Options.ImageConfig,
		PodConfig:    item.Spec.PodTemplate.Options.PodConfig,
		HomeVolume:   *item.Spec.PodTemplate.Volumes.Home,
		DataVolumes:  dataVolumes,
		Labels:       item.ObjectMeta.Labels,
		Annotations:  item.ObjectMeta.Annotations,
		Status:       string(item.Status.State),
		LastActivity: formattedLastActivity,
	}
	return workspaceModel
}
