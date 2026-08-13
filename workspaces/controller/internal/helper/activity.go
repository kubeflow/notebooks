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

package helper

import (
	"fmt"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

// ActivityRuleDecision is the result of evaluating the activityRules for a specific effect.
//
// The type parameter T allows supporting both boolean effects (like pauseWorkspace) and
// potential future non-boolean effects (like logRetentionDays or resourceLimits).
type ActivityRuleDecision[T any] struct {
	// Matched reports whether a rule with the requested effect matched.
	Matched bool

	// Value is the value of the matched rule's effect.
	Value T

	// SecondsSinceActive is the idle timeout (in seconds) from the matched rule's config.
	SecondsSinceActive int32

	// MinRunningSeconds is the minimum running duration (in seconds) from the matched rule's config.
	MinRunningSeconds int32
}

// EvaluateActivityRule finds the first activityRule whose match applies to the Workspace
// and which configures the requested effect.
//
// Rules are evaluated in order (first-match-wins). A rule with a nil/empty match is a catch-all.
// Only a rule with a non-nil effect (as determined by getEffect) terminates evaluation; rules
// where getEffect returns nil are skipped (fallthrough) for this effect type.
//
// namespaceLabels are the labels of the Workspace's namespace, and podConfigLabels are the
// labels of the podConfig option the Workspace is currently using.
func EvaluateActivityRule[T any](
	rules []kubefloworgv1beta1.ActivityRule,
	namespaceLabels, podConfigLabels map[string]string,
	getEffect func(kubefloworgv1beta1.ActivityRuleEffect) *T,
) (ActivityRuleDecision[T], error) {
	for i := range rules {
		rule := &rules[i]

		effect := getEffect(rule.Effect)
		if effect == nil {
			// this rule does not configure the requested effect, fall through.
			continue
		}

		matched, err := activityRuleMatches(rule.Match, namespaceLabels, podConfigLabels)
		if err != nil {
			return ActivityRuleDecision[T]{}, fmt.Errorf("failed to evaluate match for activityRule[%d]: %w", i, err)
		}
		if !matched {
			continue
		}

		minRunningSeconds := int32(0)
		if rule.Config.MinRunningSeconds != nil {
			minRunningSeconds = *rule.Config.MinRunningSeconds
		}

		return ActivityRuleDecision[T]{
			Matched:            true,
			Value:              *effect,
			SecondsSinceActive: rule.Config.SecondsSinceActive,
			MinRunningSeconds:  minRunningSeconds,
		}, nil
	}

	return ActivityRuleDecision[T]{Matched: false}, nil
}

// EvaluatePauseWorkspaceRule is a convenience wrapper around EvaluateActivityRule for the
// pauseWorkspace effect.
func EvaluatePauseWorkspaceRule(rules []kubefloworgv1beta1.ActivityRule, namespaceLabels, podConfigLabels map[string]string) (ActivityRuleDecision[bool], error) {
	return EvaluateActivityRule(rules, namespaceLabels, podConfigLabels, func(e kubefloworgv1beta1.ActivityRuleEffect) *bool {
		return e.PauseWorkspace
	})
}

// activityRuleMatches reports whether the given match applies to a Workspace with the provided
// namespace and podConfig labels. A nil/empty match is treated as a catch-all (always matches).
// When both matchNamespace and matchPodConfig are set, both must match (AND semantics).
func activityRuleMatches(match *kubefloworgv1beta1.ActivityRuleMatch, namespaceLabels, podConfigLabels map[string]string) (bool, error) {
	if match == nil {
		return true, nil
	}
	if match.MatchNamespace == nil && match.MatchPodConfig == nil {
		return true, nil
	}

	if match.MatchNamespace != nil {
		ok, err := selectorMatches(&match.MatchNamespace.Selector, namespaceLabels)
		if err != nil {
			return false, err
		}
		if !ok {
			return false, nil
		}
	}

	if match.MatchPodConfig != nil {
		ok, err := selectorMatches(&match.MatchPodConfig.Selector, podConfigLabels)
		if err != nil {
			return false, err
		}
		if !ok {
			return false, nil
		}
	}

	return true, nil
}

var (
	// selectorCache stores compiled labels.Selector instances to eliminate redundant
	// metav1.LabelSelectorAsSelector parsing across high-frequency reconciles and large
	// numbers of Workspaces referencing the same WorkspaceKind selectors.
	selectorCache sync.Map // map[string]cachedSelector
)

type cachedSelector struct {
	sel labels.Selector
	err error
}

// selectorMatches converts a metav1.LabelSelector and evaluates it against the given labels.
// Compiled selectors are cached to avoid redundant parsing across reconciles.
func selectorMatches(selector *metav1.LabelSelector, lbls map[string]string) (bool, error) {
	if selector == nil {
		return true, nil
	}

	key := metav1.FormatLabelSelector(selector)
	cached, ok := selectorCache.Load(key)

	var sel labels.Selector
	var err error
	if ok {
		c := cached.(cachedSelector)
		sel, err = c.sel, c.err
	} else {
		sel, err = metav1.LabelSelectorAsSelector(selector)
		selectorCache.Store(key, cachedSelector{sel: sel, err: err})
	}

	if err != nil {
		return false, err
	}
	return sel.Matches(labels.Set(lbls)), nil
}

// PodConfigLabelsToMap converts the spawner labels of a podConfig option into a label map that
// can be evaluated by a matchPodConfig selector.
func PodConfigLabelsToMap(podConfig *kubefloworgv1beta1.PodConfigValue) map[string]string {
	if podConfig == nil {
		return nil
	}
	result := make(map[string]string, len(podConfig.Spawner.Labels))
	for _, label := range podConfig.Spawner.Labels {
		result[label.Key] = label.Value
	}
	return result
}

// CalculateEligibleAfter returns the time (UNIX epoch in milliseconds) after which the Workspace
// would become eligible for the pauseWorkspace effect, given the last activity timestamp and the
// rule's secondsSinceActive.
//
// If lastActivity is unknown (<= 0), it returns 0.
func CalculateEligibleAfter(lastActivity int64, secondsSinceActive int32) int64 {
	if lastActivity <= 0 {
		return 0
	}
	return lastActivity + (time.Duration(secondsSinceActive) * time.Second).Milliseconds()
}

// IsEligibleForPause reports whether the Workspace is currently eligible to be paused for
// inactivity, and returns the eligibleAfter timestamp used in the decision.
//
// A Workspace is eligible when:
//   - the current time is at or after eligibleAfter (lastActivity + secondsSinceActive), AND
//   - the Workspace has been running for at least minRunningSeconds (based on lastRunningTime).
//
// lastActivity, lastRunningTime and now are all UNIX epoch in milliseconds.
func IsEligibleForPause(lastActivity, lastRunningTime, now int64, secondsSinceActive, minRunningSeconds int32) (bool, int64) {
	eligibleAfter := CalculateEligibleAfter(lastActivity, secondsSinceActive)

	// never pause based on an unknown activity time.
	if lastActivity <= 0 {
		return false, eligibleAfter
	}

	if now < eligibleAfter {
		return false, eligibleAfter
	}

	// enforce the minimum running duration guard.
	if minRunningSeconds > 0 {
		if lastRunningTime <= 0 {
			return false, eligibleAfter
		}
		runningDuration := time.Duration(now-lastRunningTime) * time.Millisecond
		if runningDuration < time.Duration(minRunningSeconds)*time.Second {
			return false, eligibleAfter
		}
	}

	return true, eligibleAfter
}
