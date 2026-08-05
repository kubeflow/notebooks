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
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	testSecondsSinceActive1Hour = int32(3600)
	testSecondsSinceActive1Day  = int32(86400)
	testMinRunningSeconds5Min   = int32(300)

	testOneHourMs       = int64(3600 * 1000)
	testBaseTimestampMs = int64(1_000_000_000_000)
)

var _ = Describe("EvaluatePauseWorkspaceRule", func() {

	pauseRule := func(secondsSinceActive int32, minRunning *int32, match *kubefloworgv1beta1.ActivityRuleMatch, pause bool) kubefloworgv1beta1.ActivityRule {
		return kubefloworgv1beta1.ActivityRule{
			Config: kubefloworgv1beta1.ActivityRuleConfig{
				SecondsSinceActive: secondsSinceActive,
				MinRunningSeconds:  minRunning,
			},
			Match: match,
			Effect: kubefloworgv1beta1.ActivityRuleEffect{
				PauseWorkspace: new(pause),
			},
		}
	}

	namespaceMatch := func(labels map[string]string) *kubefloworgv1beta1.ActivityRuleMatch {
		return &kubefloworgv1beta1.ActivityRuleMatch{
			MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
				Selector: metav1.LabelSelector{MatchLabels: labels},
			},
		}
	}

	podConfigMatch := func(labels map[string]string) *kubefloworgv1beta1.ActivityRuleMatch {
		return &kubefloworgv1beta1.ActivityRuleMatch{
			MatchPodConfig: &kubefloworgv1beta1.PodConfigMatch{
				Selector: metav1.LabelSelector{MatchLabels: labels},
			},
		}
	}

	It("should match a catch-all rule when match is nil", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, nil, true),
		}
		decision, err := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.Value).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(testSecondsSinceActive1Hour))
		Expect(decision.MinRunningSeconds).To(Equal(int32(0)))
	})

	It("should match the first applicable rule (first-match-wins)", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, new(testMinRunningSeconds5Min), namespaceMatch(map[string]string{"tier": "development"}), true),
			pauseRule(testSecondsSinceActive1Day, nil, nil, true),
		}

		// namespace matches the first rule
		decision, err := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "development"}, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(testSecondsSinceActive1Hour))
		Expect(decision.MinRunningSeconds).To(Equal(testMinRunningSeconds5Min))
	})

	It("should fall through to the catch-all when the namespace does not match", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, namespaceMatch(map[string]string{"tier": "development"}), true),
			pauseRule(testSecondsSinceActive1Day, nil, nil, true),
		}

		decision, err := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "production"}, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(testSecondsSinceActive1Day))
	})

	It("should require both namespace and podConfig selectors to match (AND semantics)", func() {
		match := &kubefloworgv1beta1.ActivityRuleMatch{
			MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
				Selector: metav1.LabelSelector{MatchLabels: map[string]string{"tier": "development"}},
			},
			MatchPodConfig: &kubefloworgv1beta1.PodConfigMatch{
				Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "true"}},
			},
		}
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, match, true),
		}

		// only namespace matches -> no match
		decision, err := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "development"}, map[string]string{"gpu": "false"})
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeFalse())

		// both match -> match
		decision, err = EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "development"}, map[string]string{"gpu": "true"})
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
	})

	It("should match by podConfig selector", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, podConfigMatch(map[string]string{"gpu": "true"}), true),
		}
		decision, err := EvaluatePauseWorkspaceRule(rules, nil, map[string]string{"gpu": "true"})
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
	})

	It("should skip rules with a nil pauseWorkspace effect", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			{
				Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: 100},
				Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: nil},
			},
			pauseRule(testSecondsSinceActive1Hour, nil, nil, true),
		}
		decision, err := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(testSecondsSinceActive1Hour))
	})

	It("should honor a matched rule with pauseWorkspace: false (exemption)", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, namespaceMatch(map[string]string{"protected": "true"}), false),
			pauseRule(testSecondsSinceActive1Day, nil, nil, true),
		}
		decision, err := EvaluatePauseWorkspaceRule(rules, map[string]string{"protected": "true"}, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.Value).To(BeFalse())
	})

	It("should return not-matched when no rule applies", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, namespaceMatch(map[string]string{"tier": "development"}), true),
		}
		decision, err := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "production"}, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeFalse())
	})

	It("should support generic effects (e.g. hypothetical saveLogs)", func() {
		// this test is a conceptual check that EvaluateActivityRule can be called with different types.
		rules := []kubefloworgv1beta1.ActivityRule{
			{
				Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: 100},
				Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: new(true)},
			},
		}

		decision, err := EvaluateActivityRule(rules, nil, nil, func(e kubefloworgv1beta1.ActivityRuleEffect) *bool {
			return e.PauseWorkspace
		})
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.Value).To(BeTrue())
	})

	It("should match when match is non-nil but both MatchNamespace and MatchPodConfig are nil", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, &kubefloworgv1beta1.ActivityRuleMatch{}, true),
		}
		decision, err := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decision.Matched).To(BeTrue())
	})

	It("should return an error on an invalid namespace label selector", func() {
		invalidMatch := &kubefloworgv1beta1.ActivityRuleMatch{
			MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
				Selector: metav1.LabelSelector{
					MatchExpressions: []metav1.LabelSelectorRequirement{
						{Key: "tier", Operator: "InvalidOp"},
					},
				},
			},
		}
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, invalidMatch, true),
			pauseRule(testSecondsSinceActive1Day, nil, nil, true),
		}
		_, err := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("failed to evaluate match for activityRule[0]"))
	})

	It("should return an error on an invalid podConfig label selector", func() {
		invalidMatch := &kubefloworgv1beta1.ActivityRuleMatch{
			MatchPodConfig: &kubefloworgv1beta1.PodConfigMatch{
				Selector: metav1.LabelSelector{
					MatchExpressions: []metav1.LabelSelectorRequirement{
						{Key: "gpu", Operator: "InvalidOp"},
					},
				},
			},
		}
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, invalidMatch, true),
		}
		_, err := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("failed to evaluate match for activityRule[0]"))
	})

	It("should reuse cached selectors on repeated evaluations", func() {
		origLabels := map[string]string{"cache-test-tier": "development"}
		overriddenLabels := map[string]string{"overridden-key": "overridden-val"}

		selector := metav1.LabelSelector{MatchLabels: origLabels}
		cacheKey := metav1.FormatLabelSelector(&selector)
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(testSecondsSinceActive1Hour, nil, &kubefloworgv1beta1.ActivityRuleMatch{
				MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{Selector: selector},
			}, true),
		}

		// 1. Verify key does not exist in cache initially
		selectorCache.Delete(cacheKey)
		_, foundBefore := selectorCache.Load(cacheKey)
		Expect(foundBefore).To(BeFalse())

		// 2. First evaluation compiles and populates the cache
		decision1, err1 := EvaluatePauseWorkspaceRule(rules, origLabels, nil)
		Expect(err1).ToNot(HaveOccurred())
		Expect(decision1.Matched).To(BeTrue())

		val1, foundAfterFirst := selectorCache.Load(cacheKey)
		Expect(foundAfterFirst).To(BeTrue())
		firstCached := val1.(cachedSelector)
		Expect(firstCached.sel).ToNot(BeNil())
		Expect(firstCached.err).ToNot(HaveOccurred())

		// 3. Second evaluation reuses the exact compiled labels.Selector
		decision2, err2 := EvaluatePauseWorkspaceRule(rules, origLabels, nil)
		Expect(err2).ToNot(HaveOccurred())
		Expect(decision2.Matched).To(BeTrue())

		val2, foundAfterSecond := selectorCache.Load(cacheKey)
		Expect(foundAfterSecond).To(BeTrue())
		secondCached := val2.(cachedSelector)
		Expect(secondCached.sel.String()).To(Equal(firstCached.sel.String()))

		// 4. Overriding the cache entry proves EvaluatePauseWorkspaceRule evaluates from cache
		customSel, err := metav1.LabelSelectorAsSelector(&metav1.LabelSelector{
			MatchLabels: overriddenLabels,
		})
		Expect(err).ToNot(HaveOccurred())
		selectorCache.Store(cacheKey, cachedSelector{sel: customSel, err: nil})

		// Original labels do not match the overridden cached selector
		decisionOverridden, err := EvaluatePauseWorkspaceRule(rules, origLabels, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decisionOverridden.Matched).To(BeFalse())

		// Overridden labels match because cache is used
		decisionOverriddenMatch, err := EvaluatePauseWorkspaceRule(rules, overriddenLabels, nil)
		Expect(err).ToNot(HaveOccurred())
		Expect(decisionOverriddenMatch.Matched).To(BeTrue())

		// Cleanup
		selectorCache.Delete(cacheKey)
	})
})

var _ = Describe("IsEligibleForPause", func() {

	It("should not be eligible before eligibleAfter", func() {
		lastActivity := testBaseTimestampMs
		now := lastActivity + testOneHourMs - 1000 // one second early
		eligible, eligibleAfter := IsEligibleForPause(lastActivity, 0, now, testSecondsSinceActive1Hour, 0)
		Expect(eligible).To(BeFalse())
		Expect(eligibleAfter).To(Equal(lastActivity + testOneHourMs))
	})

	It("should be eligible at or after eligibleAfter with no minRunningSeconds", func() {
		lastActivity := testBaseTimestampMs
		now := lastActivity + testOneHourMs
		eligible, _ := IsEligibleForPause(lastActivity, 0, now, testSecondsSinceActive1Hour, 0)
		Expect(eligible).To(BeTrue())
	})

	It("should not be eligible when running duration is below minRunningSeconds", func() {
		lastActivity := testBaseTimestampMs
		now := lastActivity + testOneHourMs
		lastRunningTime := now - 60*1000 // running for only 60s
		eligible, _ := IsEligibleForPause(lastActivity, lastRunningTime, now, testSecondsSinceActive1Hour, testMinRunningSeconds5Min)
		Expect(eligible).To(BeFalse())
	})

	It("should be eligible when running duration meets minRunningSeconds", func() {
		lastActivity := testBaseTimestampMs
		now := lastActivity + testOneHourMs
		lastRunningTime := now - 600*1000 // running for 600s
		eligible, _ := IsEligibleForPause(lastActivity, lastRunningTime, now, testSecondsSinceActive1Hour, testMinRunningSeconds5Min)
		Expect(eligible).To(BeTrue())
	})

	It("should not be eligible when lastActivity is unknown (0)", func() {
		now := testBaseTimestampMs
		eligible, _ := IsEligibleForPause(0, 0, now, testSecondsSinceActive1Hour, 0)
		Expect(eligible).To(BeFalse())
	})

	It("should not be eligible when minRunningSeconds is set but lastRunningTime is unknown", func() {
		lastActivity := testBaseTimestampMs
		now := lastActivity + testOneHourMs
		eligible, _ := IsEligibleForPause(lastActivity, 0, now, testSecondsSinceActive1Hour, testMinRunningSeconds5Min)
		Expect(eligible).To(BeFalse())
	})
})

var _ = Describe("CalculateEligibleAfter", func() {
	It("should add secondsSinceActive (in ms) to lastActivity", func() {
		Expect(CalculateEligibleAfter(1000, 60)).To(Equal(int64(1000 + 60*1000)))
	})

	It("should return 0 when lastActivity is unknown (<= 0)", func() {
		Expect(CalculateEligibleAfter(0, 60)).To(Equal(int64(0)))
		Expect(CalculateEligibleAfter(-1, 60)).To(Equal(int64(0)))
	})
})

var _ = Describe("PodConfigLabelsToMap", func() {
	It("should return nil for a nil podConfig", func() {
		Expect(PodConfigLabelsToMap(nil)).To(BeNil())
	})

	It("should convert spawner labels to a map", func() {
		podConfig := &kubefloworgv1beta1.PodConfigValue{
			Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
				Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
					{Key: "gpu", Value: "true"},
					{Key: "size", Value: "large"},
				},
			},
		}
		Expect(PodConfigLabelsToMap(podConfig)).To(Equal(map[string]string{
			"gpu":  "true",
			"size": "large",
		}))
	})
})
