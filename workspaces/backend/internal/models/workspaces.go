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
	"strings"
	"time"
)

type WorkspaceModel struct {
	Name         string `json:"name"`
	Kind         string `json:"kind"`
	Image        string `json:"image"`
	Config       string `json:"config"`
	Status       string `json:"status"`
	HomeVolume   string `json:"home_volume"`
	DataVolume   string `json:"data_volume"`
	LastActivity string `json:"last_activity"`
}

func NewWorkspaceModelFromWorkspace(item *kubefloworgv1beta1.Workspace) WorkspaceModel {
	t := time.Unix(item.Status.Activity.LastActivity, 0)
	formattedLastActivity := t.Format("2006-01-02 15:04:05 MST")

	mountPaths := make([]string, 0, len(item.Spec.PodTemplate.Volumes.Data))
	for _, volume := range item.Spec.PodTemplate.Volumes.Data {
		mountPaths = append(mountPaths, volume.MountPath)
	}

	workspaceModel := WorkspaceModel{
		Name:         item.ObjectMeta.Name,
		Kind:         item.Spec.Kind,
		Image:        item.Spec.PodTemplate.Options.ImageConfig,
		Config:       item.Spec.PodTemplate.Options.PodConfig,
		HomeVolume:   *item.Spec.PodTemplate.Volumes.Home,
		Status:       string(item.Status.State),
		DataVolume:   strings.Join(mountPaths, ","),
		LastActivity: formattedLastActivity,
	}
	return workspaceModel
}
