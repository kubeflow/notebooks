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

package details

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	commonWorkspaces "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/common"
)

func NewWorkspaceDetailsFromWorkspace(
	ws *kubefloworgv1beta1.Workspace,
	wsk *kubefloworgv1beta1.WorkspaceKind,
) WorkspaceDetails {
	commonWorkspaces.EnsureWskMatchesWorkspace(ws, wsk)

	var pod *WorkspaceDetailPod
	if ws.Status.PodTemplatePod.Name != "" {
		var containers []WorkspaceDetailContainer
		if len(ws.Status.PodTemplatePod.Containers) > 0 {
			containers = make([]WorkspaceDetailContainer, len(ws.Status.PodTemplatePod.Containers))
			for i, c := range ws.Status.PodTemplatePod.Containers {
				containers[i] = WorkspaceDetailContainer{Name: c.Name}
			}
		}
		var initContainers []WorkspaceDetailContainer
		if len(ws.Status.PodTemplatePod.InitContainers) > 0 {
			initContainers = make([]WorkspaceDetailContainer, len(ws.Status.PodTemplatePod.InitContainers))
			for i, c := range ws.Status.PodTemplatePod.InitContainers {
				initContainers[i] = WorkspaceDetailContainer{Name: c.Name}
			}
		}
		pod = &WorkspaceDetailPod{
			Name:           ws.Status.PodTemplatePod.Name,
			NodeName:       ws.Status.PodTemplatePod.NodeName,
			Containers:     containers,
			InitContainers: initContainers,
		}
	}

	return WorkspaceDetails{
		PodMetadata: commonWorkspaces.ExtractPodMetadata(ws),
		Volumes: WorkspaceDetailVolumes{
			Home:    commonWorkspaces.BuildHomeVolume(ws, wsk),
			Data:    commonWorkspaces.BuildDataVolumes(ws),
			Secrets: commonWorkspaces.BuildSecretVolumes(ws),
		},
		Pod: pod,
	}
}
