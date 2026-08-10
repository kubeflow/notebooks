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

// Package filterrules implements the shared, firewall-style (first-match-wins)
// evaluation engine for WorkspaceKind `spec.filterRules[]`. It is intentionally
// dependency-light (pure in-memory label matching plus the CRD types) so it can
// be reused by both the `/listvalues` (#846) and `/workspacekinds` (#847) APIs.
package filterrules

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// EvalTarget identifies the single value being evaluated and supplies its own labels.
type EvalTarget struct {
	// Scope is the type of value being evaluated (IMAGE_CONFIG, POD_CONFIG, or WORKSPACE_KIND).
	Scope kubefloworgv1beta1.FilterRuleScope

	// Labels are this value's own `spawner.labels`, used for same-scope match conditions.
	Labels []kubefloworgv1beta1.OptionSpawnerLabel
}

// EvalContext holds the request-scoped inputs shared across all evaluations.
//
// A nil label map means the corresponding context was NOT provided in the request, so any
// match condition that requires it is treated as non-matching (conservative: don't hide or
// deny without full context). A non-nil but empty map means the context was provided but
// carries no labels.
type EvalContext struct {
	// NamespaceLabels are the labels of the namespace the workspace would be created in.
	// nil when `context.namespace.name` was absent from the request.
	NamespaceLabels map[string]string

	// ImageConfigLabels are the `spawner.labels` of the imageConfig value selected in the
	// request. nil when `context.imageConfig.id` was absent. Used for cross-option matching
	// on non-IMAGE_CONFIG scope rules.
	ImageConfigLabels map[string]string

	// PodConfigLabels are the `spawner.labels` of the podConfig value selected in the
	// request. nil when `context.podConfig.id` was absent. Used for cross-option matching
	// on non-POD_CONFIG scope rules.
	PodConfigLabels map[string]string
}

// EvalResult is the outcome of evaluating the filter rules for a single value.
type EvalResult struct {
	// UIHide is the `effect.ui.hide` value from the first matching rule.
	UIHide bool

	// APIHide is the `effect.api.hide` value from the first matching rule.
	// When true the value must be omitted from the API response entirely.
	APIHide bool

	// Restrictions holds `deny` and `denyMessage` from the first matching `api.deny` rule.
	Restrictions common.Restrictions
}

// Evaluate runs the filter rules over the given target using first-match-wins,
// firewall-style semantics.
//
// Rules are evaluated top-to-bottom. The first rule whose scope matches the target AND all
// of whose match conditions are satisfied determines the result; no further rules are
// considered. If no rule matches, the non-restrictive zero-value result is returned
// (UIHide=false, APIHide=false, Restrictions.Deny=false).
func Evaluate(rules []kubefloworgv1beta1.FilterRule, target EvalTarget, evalCtx EvalContext) EvalResult {
	// resolve the target's own labels once for same-scope match conditions
	targetLabels := spawnerLabelsToMap(target.Labels)

	for i := range rules {
		rule := &rules[i]

		// skip rules whose scope does not match the value type being evaluated
		if rule.Scope != target.Scope {
			continue
		}

		// evaluate ALL match conditions with AND logic
		if !allConditionsMatch(rule.Match, target.Scope, targetLabels, evalCtx) {
			continue
		}

		// first matching rule wins: build the result from its effect and stop
		return resultFromEffect(rule.Effect)
	}

	// no rules matched: non-restrictive default
	return EvalResult{Restrictions: common.DefaultRestrictions()}
}

// BuildEvalContext resolves the request-scoped inputs shared across all filter rule evaluations.
//
// namespaceLabels are passed through as-is (nil when no namespace context was provided). The
// imageConfig/podConfig labels are resolved from the `spawner.labels` of the value selected via
// `context.imageConfig.id` / `context.podConfig.id`, enabling cross-option matching. They remain
// nil when the corresponding context id is empty or does not match any value.
func BuildEvalContext(wsk *kubefloworgv1beta1.WorkspaceKind, namespaceLabels map[string]string, imageConfigID, podConfigID string) EvalContext {
	evalCtx := EvalContext{
		NamespaceLabels: namespaceLabels,
	}

	if imageConfigID != "" {
		for i := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
			value := &wsk.Spec.PodTemplate.Options.ImageConfig.Values[i]
			if value.Id == imageConfigID {
				evalCtx.ImageConfigLabels = spawnerLabelsToMap(value.Spawner.Labels)
				break
			}
		}
	}

	if podConfigID != "" {
		for i := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
			value := &wsk.Spec.PodTemplate.Options.PodConfig.Values[i]
			if value.Id == podConfigID {
				evalCtx.PodConfigLabels = spawnerLabelsToMap(value.Spawner.Labels)
				break
			}
		}
	}

	return evalCtx
}

// allConditionsMatch returns true only if every match condition is satisfied (AND logic).
func allConditionsMatch(match []kubefloworgv1beta1.FilterRuleMatch, targetScope kubefloworgv1beta1.FilterRuleScope, targetLabels map[string]string, evalCtx EvalContext) bool {
	for i := range match {
		if !conditionMatches(&match[i], targetScope, targetLabels, evalCtx) {
			return false
		}
	}
	return true
}

// conditionMatches evaluates a single match condition against the resolved label set.
//
// Exactly one of matchNamespace / matchImageConfig / matchPodConfig is set (enforced by the
// CRD webhook). If the label set required by the condition is absent (nil), the condition is
// treated as non-matching.
func conditionMatches(match *kubefloworgv1beta1.FilterRuleMatch, targetScope kubefloworgv1beta1.FilterRuleScope, targetLabels map[string]string, evalCtx EvalContext) bool {
	switch {
	case match.MatchNamespace != nil:
		return matchSelector(match.MatchNamespace.Selector, evalCtx.NamespaceLabels)
	case match.MatchImageConfig != nil:
		return matchSelector(match.MatchImageConfig.Selector, imageConfigLabels(targetScope, targetLabels, evalCtx))
	case match.MatchPodConfig != nil:
		return matchSelector(match.MatchPodConfig.Selector, podConfigLabels(targetScope, targetLabels, evalCtx))
	default:
		// no recognized condition set: treat as non-matching
		return false
	}
}

// imageConfigLabels resolves which labels a matchImageConfig condition evaluates against.
// For IMAGE_CONFIG scope evaluation the labels come from the value being evaluated (target);
// for any other scope they come from the request-selected imageConfig (cross-option matching).
func imageConfigLabels(targetScope kubefloworgv1beta1.FilterRuleScope, targetLabels map[string]string, evalCtx EvalContext) map[string]string {
	if targetScope == kubefloworgv1beta1.FilterRuleScopeImageConfig {
		return targetLabels
	}
	return evalCtx.ImageConfigLabels
}

// podConfigLabels resolves which labels a matchPodConfig condition evaluates against.
// For POD_CONFIG scope evaluation the labels come from the value being evaluated (target);
// for any other scope they come from the request-selected podConfig (cross-option matching).
func podConfigLabels(targetScope kubefloworgv1beta1.FilterRuleScope, targetLabels map[string]string, evalCtx EvalContext) map[string]string {
	if targetScope == kubefloworgv1beta1.FilterRuleScopePodConfig {
		return targetLabels
	}
	return evalCtx.PodConfigLabels
}

// matchSelector compiles the label selector and evaluates it against the given labels.
//
// When targetLabels is nil the required context is absent, so the condition is non-matching
// regardless of the selector (conservative: don't hide or deny without full context). An
// invalid selector (which the CRD webhook should already reject) is also non-matching.
func matchSelector(labelSelector metav1.LabelSelector, targetLabels map[string]string) bool {
	if targetLabels == nil {
		return false
	}

	selector, err := metav1.LabelSelectorAsSelector(&labelSelector)
	if err != nil {
		return false
	}

	return selector.Matches(labels.Set(targetLabels))
}

// resultFromEffect converts a matched rule's effect into an EvalResult.
func resultFromEffect(effect kubefloworgv1beta1.FilterRuleEffect) EvalResult {
	result := EvalResult{Restrictions: common.DefaultRestrictions()}

	if effect.UI != nil {
		result.UIHide = effect.UI.Hide
	}

	if effect.API != nil {
		if effect.API.Hide != nil {
			result.APIHide = *effect.API.Hide
		}
		if effect.API.Deny != nil && *effect.API.Deny {
			result.Restrictions.Deny = true
			if effect.API.DenyMessage != nil {
				result.Restrictions.DenyMessage = &common.DenyMessage{
					Text: effect.API.DenyMessage.Text,
				}
			}
		}
	}

	return result
}

// spawnerLabelsToMap converts a slice of CRD spawner labels into a label map suitable for
// selector matching. It always returns a non-nil map so callers can distinguish "present
// with no labels" (non-nil empty) from "absent" (nil).
func spawnerLabelsToMap(spawnerLabels []kubefloworgv1beta1.OptionSpawnerLabel) map[string]string {
	result := make(map[string]string, len(spawnerLabels))
	for i := range spawnerLabels {
		result[spawnerLabels[i].Key] = spawnerLabels[i].Value
	}
	return result
}
