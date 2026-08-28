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
	"github.com/kubeflow/notebooks/workspaces/backend/internal/filterrules"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

// NewWorkspaceKindModelFromWorkspaceKind creates a WorkspaceKind model from a WorkspaceKind object.
// Asset SHA256 hashes and error codes are read directly from the WorkspaceKind status.
//
// namespaceLabels are the labels of the namespace named in the request's `namespaceFilter`
// (resolved by the caller via the k8s API), or nil when `namespaceFilter` was not provided.
// The WorkspaceKind's `spec.filterRules[]` with `scope: WORKSPACE_KIND` are evaluated against
// these labels; apiHide is true when a matching rule has `api.hide`, signalling the caller to
// omit the WorkspaceKind from the response entirely.
func NewWorkspaceKindModelFromWorkspaceKind(cfg *config.EnvConfig, wsk *kubefloworgv1beta1.WorkspaceKind, namespaceLabels map[string]string) (item WorkspaceKindListItem, apiHide bool) {
	// evaluate the WorkspaceKind's WORKSPACE_KIND-scoped filter rules (first-match-wins).
	// only matchNamespace conditions apply at this scope; when namespaceLabels is nil (no
	// namespaceFilter), those conditions are non-matching, so nothing is hidden or denied.
	result := filterrules.EvaluateWorkspaceFilterScopeRule(wsk, namespaceLabels)

	// `api.hide` omits the WorkspaceKind from the response entirely; skip building the model
	if result.APIHide {
		return WorkspaceKindListItem{}, true
	}

	podLabels := make(map[string]string)
	podAnnotations := make(map[string]string)
	if wsk.Spec.PodTemplate.PodMetadata != nil {
		// NOTE: we copy the maps to avoid creating a reference to the original maps.
		maps.Copy(podLabels, wsk.Spec.PodTemplate.PodMetadata.Labels)
		maps.Copy(podAnnotations, wsk.Spec.PodTemplate.PodMetadata.Annotations)
	}

	stsLabels := make(map[string]string)
	stsAnnotations := make(map[string]string)
	if wsk.Spec.PodTemplate.StatefulSetMetadata != nil {
		// NOTE: we copy the maps to avoid creating a reference to the original maps.
		maps.Copy(stsLabels, wsk.Spec.PodTemplate.StatefulSetMetadata.Labels)
		maps.Copy(stsAnnotations, wsk.Spec.PodTemplate.StatefulSetMetadata.Annotations)
	}

	//
	// TODO: remove these once frontend migrates to the new listValues endpoint for both create/update and wsk admin views
	//
	listValuesRequest := &options.ListValuesRequest{}
	podTemplateOptions, err := options.NewPodTemplateOptionsModelFromWorkspaceKind(wsk, listValuesRequest, nil)
	if err != nil {
		panic("invalid call to NewPodTemplateOptionsModelFromWorkspaceKind: " + err.Error())
	}

	return WorkspaceKindListItem{
		Name:               wsk.Name,
		DisplayName:        wsk.Spec.Spawner.DisplayName,
		Description:        wsk.Spec.Spawner.Description,
		Deprecated:         ptr.Deref(wsk.Spec.Spawner.Deprecated, false),
		DeprecationMessage: ptr.Deref(wsk.Spec.Spawner.DeprecationMessage, ""),
		// `hidden` is the admin-set value OR the `ui.hide` effect of the first matching rule
		Hidden: ptr.Deref(wsk.Spec.Spawner.Hidden, false) || result.UIHide,
		Icon:   assets.NewImageRefFromWorkspaceKindAssetIcon(cfg, wsk.Spec.Spawner.Icon, wsk.Status.SpawnerIcon, wsk.Name),
		Logo:   assets.NewImageRefFromWorkspaceKindAssetLogo(cfg, wsk.Spec.Spawner.Logo, wsk.Status.SpawnerLogo, wsk.Name),
		// TODO: in the future will need to support including exactly one of clusterMetrics or namespaceMetrics based on request context
		ClusterMetrics: ClusterKindMetrics{
			Workspaces: wsk.Status.Workspaces,
		},
		PodTemplate: PodTemplate{
			PodMetadata: PodMetadata{
				Labels:      podLabels,
				Annotations: podAnnotations,
			},
			StatefulSetMetadata: StatefulSetMetadata{
				Labels:      stsLabels,
				Annotations: stsAnnotations,
			},
			VolumeMounts: PodVolumeMounts{
				Home: wsk.Spec.PodTemplate.VolumeMounts.Home,
			},
			ActivityProbe: buildActivityProbe(wsk.Spec.PodTemplate.ActivityProbe),
			Options:       *podTemplateOptions,
		},
		ActivityRules: buildActivityRules(wsk.Spec.ActivityRules),
		Restrictions:  result.Restrictions,
	}, false
}

func buildActivityProbe(probe *kubefloworgv1beta1.ActivityProbe) *ActivityProbe {
	if probe == nil {
		return nil
	}

	var podExec *ActivityProbePodExec
	if probe.PodExec != nil {
		// NOTE: Script is excluded from ActivityProbePodExec in the WSK list for size reasons.
		podExec = &ActivityProbePodExec{
			TimeoutSeconds: ptr.Deref(probe.PodExec.TimeoutSeconds, kubefloworgv1beta1.DefaultPodExecTimeoutSeconds),
		}
	}

	var jupyter *ActivityProbeJupyter
	if probe.Jupyter != nil {
		jupyter = &ActivityProbeJupyter{
			LastActivity: probe.Jupyter.LastActivity,
			PortId:       string(probe.Jupyter.PortId),
		}
	}

	return &ActivityProbe{
		MinProbeIntervalSeconds: ptr.Deref(probe.MinProbeIntervalSeconds, kubefloworgv1beta1.DefaultMinProbeIntervalSeconds),
		ProbeIntervalSeconds:    ptr.Deref(probe.ProbeIntervalSeconds, kubefloworgv1beta1.DefaultProbeIntervalSeconds),
		PodExec:                 podExec,
		Jupyter:                 jupyter,
	}
}

func buildActivityRules(rules []kubefloworgv1beta1.ActivityRule) []ActivityRule {
	if len(rules) == 0 {
		return nil
	}
	res := make([]ActivityRule, len(rules))
	for i, rule := range rules {
		var match *ActivityRuleMatch
		if rule.Match != nil {
			var matchNs *MatchNamespace
			if rule.Match.MatchNamespace != nil {
				matchNs = &MatchNamespace{
					Selector: *rule.Match.MatchNamespace.Selector.DeepCopy(),
				}
			}
			var matchPodConfig *MatchPodConfig
			if rule.Match.MatchPodConfig != nil {
				matchPodConfig = &MatchPodConfig{
					Selector: *rule.Match.MatchPodConfig.Selector.DeepCopy(),
				}
			}
			match = &ActivityRuleMatch{
				MatchNamespace: matchNs,
				MatchPodConfig: matchPodConfig,
			}
		}

		res[i] = ActivityRule{
			Config: ActivityRuleConfig{
				SecondsSinceActive: rule.Config.SecondsSinceActive,
				MinRunningSeconds:  ptr.Deref(rule.Config.MinRunningSeconds, 0),
			},
			Match: match,
			Effect: ActivityRuleEffect{
				PauseWorkspace: ptr.Deref(rule.Effect.PauseWorkspace, false),
			},
		}
	}
	return res
}
