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
	return &WorkspaceCreate{
		Name:         ws.Name,
		Kind:         ws.Spec.Kind,
		Paused:       ptr.Deref(ws.Spec.Paused, false),
		DeferUpdates: ptr.Deref(ws.Spec.DeferUpdates, false),
		PodTemplate:  buildPodTemplateMutate(ws),
	}
}

// NewWorkspaceUpdateModelFromWorkspace creates WorkspaceUpdate model from a Workspace object.
func NewWorkspaceUpdateModelFromWorkspace(ws *kubefloworgv1beta1.Workspace) *WorkspaceUpdate {
	return &WorkspaceUpdate{
		Revision:     CalculateWorkspaceRevision(ws),
		Paused:       ptr.Deref(ws.Spec.Paused, false),
		DeferUpdates: ptr.Deref(ws.Spec.DeferUpdates, false),
		PodTemplate:  buildPodTemplateMutate(ws),
	}
}

// buildPodTemplateMutate constructs a PodTemplateMutate from a Workspace spec.
func buildPodTemplateMutate(ws *kubefloworgv1beta1.Workspace) PodTemplateMutate {
	podLabels, podAnnotations := extractPodMetadata(ws)
	return PodTemplateMutate{
		PodMetadata: PodMetadataMutate{
			Labels:      podLabels,
			Annotations: podAnnotations,
		},
		Volumes: PodVolumesMutate{
			Home:    ws.Spec.PodTemplate.Volumes.Home,
			Data:    extractDataVolumes(ws),
			Secrets: extractSecretMounts(ws),
		},
		Options: PodTemplateOptionsMutate{
			ImageConfig: ws.Spec.PodTemplate.Options.ImageConfig,
			PodConfig:   ws.Spec.PodTemplate.Options.PodConfig,
		},
	}
}

// extractPodMetadata extracts and copies pod labels and annotations from a Workspace spec.
// Returns copies of the maps to avoid creating references to the original maps.
func extractPodMetadata(ws *kubefloworgv1beta1.Workspace) (labels map[string]string, annotations map[string]string) {
	labels = make(map[string]string)
	annotations = make(map[string]string)
	if ws.Spec.PodTemplate.PodMetadata != nil {
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Labels {
			labels[k] = v
		}
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Annotations {
			annotations[k] = v
		}
	}
	return labels, annotations
}

// extractDataVolumes converts workspace data volumes to PodVolumeMount slice.
func extractDataVolumes(ws *kubefloworgv1beta1.Workspace) []PodVolumeMount {
	dataVolumes := make([]PodVolumeMount, len(ws.Spec.PodTemplate.Volumes.Data))
	for i, v := range ws.Spec.PodTemplate.Volumes.Data {
		dataVolumes[i] = PodVolumeMount{
			PVCName:   v.PVCName,
			MountPath: v.MountPath,
			ReadOnly:  ptr.Deref(v.ReadOnly, false),
		}
	}
	return dataVolumes
}

// extractSecretMounts converts workspace secret volumes to PodSecretMount slice.
func extractSecretMounts(ws *kubefloworgv1beta1.Workspace) []PodSecretMount {
	secretMounts := make([]PodSecretMount, len(ws.Spec.PodTemplate.Volumes.Secrets))
	for i, s := range ws.Spec.PodTemplate.Volumes.Secrets {
		secretMounts[i] = PodSecretMount{
			SecretName:  s.SecretName,
			MountPath:   s.MountPath,
			DefaultMode: s.DefaultMode,
		}
	}
	return secretMounts
}

// CalculateWorkspaceRevision calculates the revision/etag for a workspace.
// FORMAT: hex(sha256("<WORKSPACE_UUID>:<WORKSPACE_NAME>:<WORKSPACE_GENERATION>"))
// this detects changes to the `spec` of the workspace, while also ensuring
// that the resource itself is the same (via UID and name).
func CalculateWorkspaceRevision(workspace *kubefloworgv1beta1.Workspace) string {
	revisionInput := fmt.Sprintf("%s:%s:%d", workspace.UID, workspace.Name, workspace.Generation)
	hash := sha256.Sum256([]byte(revisionInput))
	return hex.EncodeToString(hash[:])
}
