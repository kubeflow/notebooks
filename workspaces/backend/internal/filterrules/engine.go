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

	// compiledRules are the WorkspaceKind's `spec.filterRules[]` with each match condition's
	// label selector compiled once, so evaluation over many option values does not recompile
	// the same selectors repeatedly.
	compiledRules []compiledRule
}

// compiledRule pairs a filter rule with its match conditions' pre-compiled selectors.
type compiledRule struct {
	rule    *kubefloworgv1beta1.FilterRule
	matches []compiledMatch
}

// compiledMatch pairs a single match condition with its pre-compiled label selector.
type compiledMatch struct {
	match    *kubefloworgv1beta1.FilterRuleMatch
	selector labels.Selector
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

// Evaluate runs the pre-compiled filter rules over the given target using
// first-match-wins, firewall-style semantics.
//
// Rules are evaluated top-to-bottom. The first rule whose scope matches the target AND all
// of whose match conditions are satisfied determines the result; no further rules are
// considered. If no rule matches, the non-restrictive zero-value result is returned
// (UIHide=false, APIHide=false, Restrictions.Deny=false).
func Evaluate(target EvalTarget, evalCtx EvalContext) EvalResult {
	// resolve the target's own labels once for same-scope match conditions
	targetLabels := spawnerLabelsToMap(target.Labels)

	for _, cr := range evalCtx.compiledRules {
		// skip rules whose scope does not match the value type being evaluated
		if cr.rule.Scope != target.Scope {
			continue
		}

		// evaluate ALL match conditions with AND logic
		if !allConditionsMatch(cr.matches, target.Scope, targetLabels, evalCtx) {
			continue
		}

		// first matching rule wins: build the result from its effect and stop
		return resultFromEffect(cr.rule.Effect)
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
		compiledRules:   compileRules(wsk.Spec.FilterRules),
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

// compileRules pre-compiles the label selector of every match condition in the given rules,
// so the (potentially many) per-value evaluations reuse the compiled selectors instead of
// recompiling them each time. Conditions whose selector fails to compile are dropped, so an
// invalid condition is ignored while the rule's remaining conditions still apply.
func compileRules(rules []kubefloworgv1beta1.FilterRule) []compiledRule {
	if len(rules) == 0 {
		return nil
	}

	compiled := make([]compiledRule, 0, len(rules))
	for _, rule := range rules {
		matches := make([]compiledMatch, 0, len(rule.Match))
		for _, match := range rule.Match {
			selector, valid := compileSelector(&match)
			if !valid {
				continue
			}
			matches = append(matches, compiledMatch{
				match:    &match,
				selector: selector,
			})
		}
		if len(matches) == 0 {
			continue
		}
		compiled = append(compiled, compiledRule{rule: &rule, matches: matches})
	}
	return compiled
}

// compileSelector compiles the label selector of the (single) set match condition.
//
// valid is false, signaling the caller to drop the condition, when the match has no recognized
// selector set or when its selector fails to compile (both of which the CRD webhook should
// already reject).
func compileSelector(match *kubefloworgv1beta1.FilterRuleMatch) (selector labels.Selector, valid bool) {
	var labelSelector *metav1.LabelSelector
	switch {
	case match.MatchNamespace != nil:
		labelSelector = &match.MatchNamespace.Selector
	case match.MatchImageConfig != nil:
		labelSelector = &match.MatchImageConfig.Selector
	case match.MatchPodConfig != nil:
		labelSelector = &match.MatchPodConfig.Selector
	default:
		return nil, false
	}

	selector, err := metav1.LabelSelectorAsSelector(labelSelector)
	if err != nil {
		return nil, false
	}
	return selector, true
}

// allConditionsMatch returns true only if every (valid) match condition is satisfied (AND logic).
func allConditionsMatch(matches []compiledMatch, targetScope kubefloworgv1beta1.FilterRuleScope, targetLabels map[string]string, evalCtx EvalContext) bool {
	for i := range matches {
		if !conditionMatches(&matches[i], targetScope, targetLabels, evalCtx) {
			return false
		}
	}
	return true
}

// conditionMatches evaluates a single (pre-compiled) match condition against the resolved label set.
//
// Exactly one of matchNamespace / matchImageConfig / matchPodConfig is set (enforced by the
// CRD webhook). If the label set required by the condition is absent (nil), the condition is
// treated as non-matching.
func conditionMatches(cm *compiledMatch, targetScope kubefloworgv1beta1.FilterRuleScope, targetLabels map[string]string, evalCtx EvalContext) bool {
	switch {
	case cm.match.MatchNamespace != nil:
		return matchSelector(cm.selector, evalCtx.NamespaceLabels)
	case cm.match.MatchImageConfig != nil:
		return matchSelector(cm.selector, imageConfigLabels(targetScope, targetLabels, evalCtx))
	case cm.match.MatchPodConfig != nil:
		return matchSelector(cm.selector, podConfigLabels(targetScope, targetLabels, evalCtx))
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

// matchSelector evaluates a pre-compiled selector against the given labels.
//
// When targetLabels is nil the required context is absent, so the condition is non-matching
// regardless of the selector (conservative: don't hide or deny without full context).
func matchSelector(selector labels.Selector, targetLabels map[string]string) bool {
	if targetLabels == nil {
		return false
	}

	return selector.Matches(labels.Set(targetLabels))
}

// resultFromEffect converts a matched rule's effect into an EvalResult.
func resultFromEffect(effect kubefloworgv1beta1.FilterRuleEffect) EvalResult {
	return EvalResult{
		UIHide:       effect.UI != nil && effect.UI.Hide,
		APIHide:      effect.API != nil && effect.API.Hide != nil && *effect.API.Hide,
		Restrictions: resolveRestrictions(effect),
	}
}

// resolveRestrictions returns the restrictions from an `api.deny` effect, or the
// non-restrictive default when the effect does not deny.
func resolveRestrictions(effect kubefloworgv1beta1.FilterRuleEffect) common.Restrictions {
	if effect.API == nil || effect.API.Deny == nil || !*effect.API.Deny {
		return common.DefaultRestrictions()
	}

	restrictions := common.Restrictions{Deny: true}
	if effect.API.DenyMessage != nil {
		restrictions.DenyMessage = &common.DenyMessage{Text: effect.API.DenyMessage.Text}
	}
	return restrictions
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
