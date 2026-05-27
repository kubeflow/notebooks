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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"
)

func NewWorkspaceDetailsFromWorkspace(
	ws *kubefloworgv1beta1.Workspace,
	wsk *kubefloworgv1beta1.WorkspaceKind,
) WorkspaceDetails {

	// copy maps to avoid aliasing
	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if ws.Spec.PodTemplate.PodMetadata != nil {
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Labels {
			podLabels[k] = v
		}
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Annotations {
			podAnnotations[k] = v
		}
	}

	// home volume mapping
	var homeVolume *PodVolumeInfo
	if ws.Spec.PodTemplate.Volumes.Home != nil {
		mountPath := UnknownHomeMountPath
		if wskExists(wsk) {
			mountPath = wsk.Spec.PodTemplate.VolumeMounts.Home
		}
		homeVolume = &PodVolumeInfo{
			PVCName:   *ws.Spec.PodTemplate.Volumes.Home,
			MountPath: mountPath,
			ReadOnly:  false,
		}
	}

	// data volumes mapping
	dataVolumes := make([]PodVolumeInfo, len(ws.Spec.PodTemplate.Volumes.Data))
	for i, v := range ws.Spec.PodTemplate.Volumes.Data {
		readOnly := ptr.Deref(v.ReadOnly, false)
		dataVolumes[i] = PodVolumeInfo{
			PVCName:   v.PVCName,
			MountPath: v.MountPath,
			ReadOnly:  readOnly,
		}
	}

	// secret volumes mapping
	secretVolumes := make([]PodSecretInfo, len(ws.Spec.PodTemplate.Volumes.Secrets))
	for i, s := range ws.Spec.PodTemplate.Volumes.Secrets {
		secretVolumes[i] = PodSecretInfo{
			SecretName:  s.SecretName,
			MountPath:   s.MountPath,
			DefaultMode: s.DefaultMode,
		}
	}

	// pod info — nil when workspace is paused (no running pod)
	var pod *WorkspaceDetailPod
	if ws.Status.PodTemplatePod.Name != "" {
		containers := make([]WorkspaceDetailContainer, len(ws.Status.PodTemplatePod.Containers))
		for i, c := range ws.Status.PodTemplatePod.Containers {
			containers[i] = WorkspaceDetailContainer{Name: c.Name}
		}
		initContainers := make([]WorkspaceDetailContainer, len(ws.Status.PodTemplatePod.InitContainers))
		for i, c := range ws.Status.PodTemplatePod.InitContainers {
			initContainers[i] = WorkspaceDetailContainer{Name: c.Name}
		}
		pod = &WorkspaceDetailPod{
			Name:           ws.Status.PodTemplatePod.Name,
			NodeName:       ws.Status.PodTemplatePod.NodeName,
			Containers:     containers,
			InitContainers: initContainers,
		}
	}

	return WorkspaceDetails{
		PodMetadata: PodMetadata{
			Labels:      podLabels,
			Annotations: podAnnotations,
		},
		Volumes: WorkspaceDetailVolumes{
			Home:    homeVolume,
			Data:    dataVolumes,
			Secrets: secretVolumes,
		},
		Pod: pod,
	}
}
