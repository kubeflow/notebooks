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

// EnsureWskMatchesWorkspace panics if the provided WorkspaceKind exists but does not match the Workspace.
func EnsureWskMatchesWorkspace(ws *kubefloworgv1beta1.Workspace, wsk *kubefloworgv1beta1.WorkspaceKind) {
	if WskExists(wsk) && ws.Spec.Kind != wsk.Name {
		panic("provided WorkspaceKind does not match the Workspace")
	}
}
