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

package workspacekinds

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

// NewWorkspaceKindModelFromWorkspaceKind creates a WorkspaceKind model from a WorkspaceKind object.
func NewWorkspaceKindModelFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind) WorkspaceKind {
	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if wsk.Spec.PodTemplate.PodMetadata != nil {
		// NOTE: we copy the maps to avoid creating a reference to the original maps.
		for k, v := range wsk.Spec.PodTemplate.PodMetadata.Labels {
			podLabels[k] = v
		}
		for k, v := range wsk.Spec.PodTemplate.PodMetadata.Annotations {
			podAnnotations[k] = v
		}
	}

	iconRef := ImageRef{
		// TODO: icons MUST be either set to remote URL or read from a ConfigMap
		//       we can remove this fallback once we implement the ConfigMap option.
		URL: ptr.Deref(wsk.Spec.Spawner.Icon.Url, "__UNKNOWN_ICON_URL__"),
	}
	logoRef := ImageRef{
		// TODO: logos MUST be either set to remote URL or read from a ConfigMap
		//       we can remove this fallback once we implement the ConfigMap option.
		URL: ptr.Deref(wsk.Spec.Spawner.Logo.Url, "__UNKNOWN_LOGO_URL__"),
	}

	//
	// TODO: remove these once frontend migrates to the new listValues endpoint for both create/update and wsk admin views
	//
	listValuesRequest := &options.ListValuesRequest{}
	podTemplateOptions, err := options.NewPodTemplateOptionsModelFromWorkspaceKind(wsk, listValuesRequest)
	if err != nil {
		panic("invalid call to NewPodTemplateOptionsModelFromWorkspaceKind: " + err.Error())
	}

	return WorkspaceKind{
		Name:               wsk.Name,
		DisplayName:        wsk.Spec.Spawner.DisplayName,
		Description:        wsk.Spec.Spawner.Description,
		Deprecated:         ptr.Deref(wsk.Spec.Spawner.Deprecated, false),
		DeprecationMessage: ptr.Deref(wsk.Spec.Spawner.DeprecationMessage, ""),
		Hidden:             ptr.Deref(wsk.Spec.Spawner.Hidden, false),
		Icon:               iconRef,
		Logo:               logoRef,
		ClusterMetrics: ClusterKindMetrics{
			Workspaces: wsk.Status.Workspaces,
		},
		PodTemplate: PodTemplate{
			PodMetadata: PodMetadata{
				Labels:      podLabels,
				Annotations: podAnnotations,
			},
			VolumeMounts: PodVolumeMounts{
				Home: wsk.Spec.PodTemplate.VolumeMounts.Home,
			},
			Options: *podTemplateOptions,
		},
	}
}
