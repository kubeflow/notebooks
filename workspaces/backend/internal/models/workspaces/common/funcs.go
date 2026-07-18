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

package common

import (
	"maps"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"
)

// WskExists checks if a WorkspaceKind is non-nil and has a valid UID.
func WskExists(wsk *kubefloworgv1beta1.WorkspaceKind) bool {
	return wsk != nil && wsk.UID != ""
}

// ExtractPodMetadata extracts labels and annotations from a workspace's pod template metadata.
func ExtractPodMetadata(ws *kubefloworgv1beta1.Workspace) PodMetadata {
	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if ws.Spec.PodTemplate.PodMetadata != nil {
		maps.Copy(podLabels, ws.Spec.PodTemplate.PodMetadata.Labels)
		maps.Copy(podAnnotations, ws.Spec.PodTemplate.PodMetadata.Annotations)
	}
	return PodMetadata{
		Labels:      podLabels,
		Annotations: podAnnotations,
	}
}

// BuildDataVolumes creates a PodVolumeInfo slice from a workspace's data volumes.
func BuildDataVolumes(ws *kubefloworgv1beta1.Workspace) []PodVolumeInfo {
	var dataVolumes []PodVolumeInfo
	if len(ws.Spec.PodTemplate.Volumes.Data) > 0 {
		dataVolumes = make([]PodVolumeInfo, 0, len(ws.Spec.PodTemplate.Volumes.Data))
		for _, v := range ws.Spec.PodTemplate.Volumes.Data {
			dataVolumes = append(dataVolumes, PodVolumeInfo{
				PVCName:   v.PVCName,
				MountPath: v.MountPath,
				ReadOnly:  ptr.Deref(v.ReadOnly, false),
			})
		}
	}
	return dataVolumes
}

// BuildSecretVolumes creates a PodSecretInfo slice from a workspace's secret volumes.
func BuildSecretVolumes(ws *kubefloworgv1beta1.Workspace) []PodSecretInfo {
	var secretVolumes []PodSecretInfo
	if len(ws.Spec.PodTemplate.Volumes.Secrets) > 0 {
		secretVolumes = make([]PodSecretInfo, len(ws.Spec.PodTemplate.Volumes.Secrets))
		for i, s := range ws.Spec.PodTemplate.Volumes.Secrets {
			secretVolumes[i] = PodSecretInfo{
				SecretName:  s.SecretName,
				MountPath:   s.MountPath,
				DefaultMode: s.DefaultMode,
			}
		}
	}
	return secretVolumes
}

// EnsureWskMatchesWorkspace panics if the provided WorkspaceKind exists but does not match the Workspace.
func EnsureWskMatchesWorkspace(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) {
	if WskExists(wsk) && ws.Spec.Kind != wsk.Name {
		panic("provided WorkspaceKind does not match the Workspace")
	}
}

// BuildHomeVolume creates a PodVolumeInfo for the workspace's home volume.
func BuildHomeVolume(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) *PodVolumeInfo {
	if ws.Spec.PodTemplate.Volumes.Home == nil {
		return nil
	}

	mountPath := UnknownHomeMountPath
	if WskExists(wsk) {
		mountPath = wsk.Spec.PodTemplate.VolumeMounts.Home
	}

	return &PodVolumeInfo{
		PVCName:   *ws.Spec.PodTemplate.Volumes.Home,
		MountPath: mountPath,
		ReadOnly:  false,
	}
}
