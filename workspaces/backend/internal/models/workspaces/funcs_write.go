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

// NewWorkspaceCreateModelFromWorkspace creates WorkspaceCreate model from a Workspace object.
func NewWorkspaceCreateModelFromWorkspace(ws *kubefloworgv1beta1.Workspace) *WorkspaceCreate {
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

	dataVolumes := make([]PodVolumeMount, len(ws.Spec.PodTemplate.Volumes.Data))
	for i, v := range ws.Spec.PodTemplate.Volumes.Data {
		dataVolumes[i] = PodVolumeMount{
			PVCName:   v.PVCName,
			MountPath: v.MountPath,
			ReadOnly:  ptr.Deref(v.ReadOnly, false),
		}
	}

	workspaceCreateModel := &WorkspaceCreate{
		Name:         ws.Name,
		Kind:         ws.Spec.Kind,
		Paused:       ptr.Deref(ws.Spec.Paused, false),
		DeferUpdates: ptr.Deref(ws.Spec.DeferUpdates, false),
		PodTemplate: PodTemplateMutate{
			PodMetadata: PodMetadataMutate{
				Labels:      podLabels,
				Annotations: podAnnotations,
			},
			Volumes: PodVolumesMutate{
				Home: ws.Spec.PodTemplate.Volumes.Home,
				Data: dataVolumes,
			},
			Options: PodTemplateOptionsMutate{
				ImageConfig: ws.Spec.PodTemplate.Options.ImageConfig,
				PodConfig:   ws.Spec.PodTemplate.Options.PodConfig,
			},
		},
	}

	return workspaceCreateModel
}
