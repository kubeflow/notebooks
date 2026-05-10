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

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/common"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"

	"k8s.io/utils/ptr"
)

// NewWorkspaceKindModelFromWorkspaceKind creates a WorkspaceKind model from a WorkspaceKind object.
// Asset SHA256 hashes and error codes are read directly from the WorkspaceKind status.
func NewWorkspaceKindModelFromWorkspaceKind(cfg *config.EnvConfig, wsk *kubefloworgv1beta1.WorkspaceKind) WorkspaceKindListItem {
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

	//
	// TODO: remove these once frontend migrates to the new listValues endpoint for both create/update and wsk admin views
	//
	listValuesRequest := &options.ListValuesRequest{}
	podTemplateOptions, err := options.NewPodTemplateOptionsModelFromWorkspaceKind(wsk, listValuesRequest)
	if err != nil {
		panic("invalid call to NewPodTemplateOptionsModelFromWorkspaceKind: " + err.Error())
	}

	return WorkspaceKindListItem{
		Name:               wsk.Name,
		DisplayName:        wsk.Spec.Spawner.DisplayName,
		Description:        wsk.Spec.Spawner.Description,
		Deprecated:         ptr.Deref(wsk.Spec.Spawner.Deprecated, false),
		DeprecationMessage: ptr.Deref(wsk.Spec.Spawner.DeprecationMessage, ""),
		Hidden:             spawnerIsHiddenForList(&wsk.Spec.Spawner),
		Restrictions:       buildRestrictions(wsk.Spec.Spawner.Effect.API),
		Icon:               assets.NewImageRefFromWorkspaceKindAssetIcon(cfg, wsk.Spec.Spawner.Icon, wsk.Status.SpawnerIcon, wsk.Name),
		Logo:               assets.NewImageRefFromWorkspaceKindAssetLogo(cfg, wsk.Spec.Spawner.Logo, wsk.Status.SpawnerLogo, wsk.Name),
		// TODO: in the future will need to support including exactly one of clusterMetrics or namespaceMetrics based on request context
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

// spawnerIsHiddenForList combines the static spawner.hidden value with effect.ui.hide.
func spawnerIsHiddenForList(sp *kubefloworgv1beta1.WorkspaceKindSpawner) bool {
	if ptr.Deref(sp.Hidden, false) {
		return true
	}
	if sp.Effect.UI != nil && ptr.Deref(sp.Effect.UI.Hide, false) {
		return true
	}
	return false
}

func IsAPIHidden(wsk *kubefloworgv1beta1.WorkspaceKind) bool {
	if wsk.Spec.Spawner.Effect.API == nil {
		return false
	}
	return ptr.Deref(wsk.Spec.Spawner.Effect.API.Hide, false)
}

func buildRestrictions(effect *kubefloworgv1beta1.WorkspaceKindEffectAPI) common.Restrictions {
	if effect == nil {
		return common.Restrictions{}
	}
	r := common.Restrictions{
		Deny: ptr.Deref(effect.Deny, false),
	}
	if effect.DenyMessage != nil && effect.DenyMessage.Text != "" {
		r.DenyMessage = &common.DenyMessage{Text: effect.DenyMessage.Text}
	}
	return r
}
