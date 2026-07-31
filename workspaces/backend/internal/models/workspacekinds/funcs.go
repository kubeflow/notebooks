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
	"maps"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

// NewWorkspaceKindModelFromWorkspaceKind creates a WorkspaceKind model from a WorkspaceKind object.
// Asset SHA256 hashes and error codes are read directly from the WorkspaceKind status.
func NewWorkspaceKindModelFromWorkspaceKind(cfg *config.EnvConfig, wsk *kubefloworgv1beta1.WorkspaceKind) WorkspaceKindListItem {
	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if wsk.Spec.PodTemplate.PodMetadata != nil {
		// NOTE: we copy the maps to avoid creating a reference to the original maps.
		maps.Copy(podLabels, wsk.Spec.PodTemplate.PodMetadata.Labels)
		maps.Copy(podAnnotations, wsk.Spec.PodTemplate.PodMetadata.Annotations)
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
		Hidden:             ptr.Deref(wsk.Spec.Spawner.Hidden, false),
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
			ActivityProbe: buildActivityProbe(wsk.Spec.PodTemplate.ActivityProbe),
			Options:       *podTemplateOptions,
		},
		ActivityRules: buildActivityRules(wsk.Spec.ActivityRules),
		//
		// TODO: replace this with the calculation of the actual restriction!
		//
		Restrictions: common.DefaultRestrictions(),
	}
}

func buildActivityProbe(probe *kubefloworgv1beta1.ActivityProbe) *ActivityProbe {
	if probe == nil {
		return nil
	}

	res := &ActivityProbe{
		MinProbeIntervalSeconds: ptr.Deref(probe.MinProbeIntervalSeconds, 300),
		ProbeIntervalSeconds:    ptr.Deref(probe.ProbeIntervalSeconds, kubefloworgv1beta1.DefaultProbeIntervalSeconds),
	}

	if probe.PodExec != nil {
		res.Exec = &ActivityProbeExec{
			TimeoutSeconds: ptr.Deref(probe.PodExec.TimeoutSeconds, 60),
			Script:         probe.PodExec.Script,
		}
	}

	if probe.Jupyter != nil {
		res.Jupyter = &ActivityProbeJupyter{
			LastActivity: probe.Jupyter.LastActivity,
			PortId:       string(probe.Jupyter.PortId),
		}
	}

	return res
}

func buildActivityRules(rules []kubefloworgv1beta1.ActivityRule) []ActivityRule {
	if len(rules) == 0 {
		return nil
	}
	res := make([]ActivityRule, len(rules))
	for i, rule := range rules {
		res[i] = ActivityRule{
			Config: ActivityRuleConfig{
				SecondsSinceActive: rule.Config.SecondsSinceActive,
				MinRunningSeconds:  ptr.Deref(rule.Config.MinRunningSeconds, 0),
			},
			Effect: ActivityRuleEffect{
				PauseWorkspace: ptr.Deref(rule.Effect.PauseWorkspace, false),
			},
		}
		if rule.Match != nil {
			var matchNs *MatchNamespace
			if rule.Match.MatchNamespace != nil {
				matchNs = &MatchNamespace{
					Selector: rule.Match.MatchNamespace.Selector,
				}
			}
			var matchPodConfig *MatchPodConfig
			if rule.Match.MatchPodConfig != nil {
				matchPodConfig = &MatchPodConfig{
					Selector: rule.Match.MatchPodConfig.Selector,
				}
			}
			res[i].Match = &ActivityRuleMatch{
				MatchNamespace: matchNs,
				MatchPodConfig: matchPodConfig,
			}
		}
	}
	return res
}
