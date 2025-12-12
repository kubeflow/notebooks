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
	"crypto/sha256"
	"encoding/hex"
	"fmt"

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

	secretMounts := make([]PodSecretMount, len(ws.Spec.PodTemplate.Volumes.Secrets))
	for i, s := range ws.Spec.PodTemplate.Volumes.Secrets {
		secretMounts[i] = PodSecretMount{
			SecretName:  s.SecretName,
			MountPath:   s.MountPath,
			DefaultMode: s.DefaultMode,
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
				Home:    ws.Spec.PodTemplate.Volumes.Home,
				Data:    dataVolumes,
				Secrets: secretMounts,
			},
			Options: PodTemplateOptionsMutate{
				ImageConfig: ws.Spec.PodTemplate.Options.ImageConfig,
				PodConfig:   ws.Spec.PodTemplate.Options.PodConfig,
			},
		},
	}

	return workspaceCreateModel
}

// NewWorkspaceUpdateModelFromWorkspace creates WorkspaceUpdate model from a Workspace object.
func NewWorkspaceUpdateModelFromWorkspace(ws *kubefloworgv1beta1.Workspace) *WorkspaceUpdate {
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

	secretMounts := make([]PodSecretMount, len(ws.Spec.PodTemplate.Volumes.Secrets))
	for i, s := range ws.Spec.PodTemplate.Volumes.Secrets {
		secretMounts[i] = PodSecretMount{
			SecretName:  s.SecretName,
			MountPath:   s.MountPath,
			DefaultMode: s.DefaultMode,
		}
	}

	workspaceUpdateModel := &WorkspaceUpdate{
		Revision:     CalculateWorkspaceRevision(ws),
		Paused:       ptr.Deref(ws.Spec.Paused, false),
		DeferUpdates: ptr.Deref(ws.Spec.DeferUpdates, false),
		PodTemplate: PodTemplateMutate{
			PodMetadata: PodMetadataMutate{
				Labels:      podLabels,
				Annotations: podAnnotations,
			},
			Volumes: PodVolumesMutate{
				Home:    ws.Spec.PodTemplate.Volumes.Home,
				Data:    dataVolumes,
				Secrets: secretMounts,
			},
			Options: PodTemplateOptionsMutate{
				ImageConfig: ws.Spec.PodTemplate.Options.ImageConfig,
				PodConfig:   ws.Spec.PodTemplate.Options.PodConfig,
			},
		},
	}

	return workspaceUpdateModel
}

// CalculateWorkspaceRevision calculates the revision token for a workspace.
// The revision is a sha256 hash of the format: <.metadata.uid>:<.metadata.name>:<.metadata.generation>
// This ensures that the revision changes not only when the generation changes, but also guarantees
// that the resource itself is the same (via UID and name).
func CalculateWorkspaceRevision(workspace *kubefloworgv1beta1.Workspace) string {
	revisionInput := fmt.Sprintf("%s:%s:%d", workspace.UID, workspace.Name, workspace.Generation)
	hash := sha256.Sum256([]byte(revisionInput))
	return hex.EncodeToString(hash[:])
}
