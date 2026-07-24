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
	"k8s.io/utils/ptr"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
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
				PauseWorkspace: ptr.To(pause),
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
			pauseRule(3600, nil, nil, true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.Value).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(int32(3600)))
		Expect(decision.MinRunningSeconds).To(Equal(int32(0)))
	})

	It("should match the first applicable rule (first-match-wins)", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(3600, ptr.To(int32(300)), namespaceMatch(map[string]string{"tier": "development"}), true),
			pauseRule(86400, nil, nil, true),
		}

		// namespace matches the first rule
		decision := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "development"}, nil)
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(int32(3600)))
		Expect(decision.MinRunningSeconds).To(Equal(int32(300)))
	})

	It("should fall through to the catch-all when the namespace does not match", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(3600, nil, namespaceMatch(map[string]string{"tier": "development"}), true),
			pauseRule(86400, nil, nil, true),
		}

		decision := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "production"}, nil)
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(int32(86400)))
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
			pauseRule(3600, nil, match, true),
		}

		// only namespace matches -> no match
		decision := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "development"}, map[string]string{"gpu": "false"})
		Expect(decision.Matched).To(BeFalse())

		// both match -> match
		decision = EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "development"}, map[string]string{"gpu": "true"})
		Expect(decision.Matched).To(BeTrue())
	})

	It("should match by podConfig selector", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(3600, nil, podConfigMatch(map[string]string{"gpu": "true"}), true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, nil, map[string]string{"gpu": "true"})
		Expect(decision.Matched).To(BeTrue())
	})

	It("should skip rules with a nil pauseWorkspace effect", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			{
				Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: 100},
				Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: nil},
			},
			pauseRule(3600, nil, nil, true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(int32(3600)))
	})

	It("should honor a matched rule with pauseWorkspace: false (exemption)", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(3600, nil, namespaceMatch(map[string]string{"protected": "true"}), false),
			pauseRule(86400, nil, nil, true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, map[string]string{"protected": "true"}, nil)
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.Value).To(BeFalse())
	})

	It("should return not-matched when no rule applies", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(3600, nil, namespaceMatch(map[string]string{"tier": "development"}), true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, map[string]string{"tier": "production"}, nil)
		Expect(decision.Matched).To(BeFalse())
	})

	It("should support generic effects (e.g. hypothetical saveLogs)", func() {
		// this test is a conceptual check that EvaluateActivityRule can be called with different types.
		rules := []kubefloworgv1beta1.ActivityRule{
			{
				Config: kubefloworgv1beta1.ActivityRuleConfig{SecondsSinceActive: 100},
				Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: ptr.To(true)},
			},
		}

		decision := EvaluateActivityRule(rules, nil, nil, func(e kubefloworgv1beta1.ActivityRuleEffect) *bool {
			return e.PauseWorkspace
		})
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.Value).To(BeTrue())
	})

	It("should match when match is non-nil but both MatchNamespace and MatchPodConfig are nil", func() {
		rules := []kubefloworgv1beta1.ActivityRule{
			pauseRule(3600, nil, &kubefloworgv1beta1.ActivityRuleMatch{}, true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(decision.Matched).To(BeTrue())
	})

	It("should treat an invalid namespace label selector as non-matching", func() {
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
			pauseRule(3600, nil, invalidMatch, true),
			pauseRule(86400, nil, nil, true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(decision.Matched).To(BeTrue())
		Expect(decision.SecondsSinceActive).To(Equal(int32(86400)))
	})

	It("should return false on an invalid podConfig label selector", func() {
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
			pauseRule(3600, nil, invalidMatch, true),
		}
		decision := EvaluatePauseWorkspaceRule(rules, nil, nil)
		Expect(decision.Matched).To(BeFalse())
	})
})

var _ = Describe("IsEligibleForPause", func() {

	const secondsSinceActive = int32(3600) // 1 hour
	const oneHourMs = int64(3600) * 1000

	It("should not be eligible before eligibleAfter", func() {
		lastActivity := int64(1_000_000_000_000)
		now := lastActivity + oneHourMs - 1000 // one second early
		eligible, eligibleAfter := IsEligibleForPause(lastActivity, 0, now, secondsSinceActive, 0)
		Expect(eligible).To(BeFalse())
		Expect(eligibleAfter).To(Equal(lastActivity + oneHourMs))
	})

	It("should be eligible at or after eligibleAfter with no minRunningSeconds", func() {
		lastActivity := int64(1_000_000_000_000)
		now := lastActivity + oneHourMs
		eligible, _ := IsEligibleForPause(lastActivity, 0, now, secondsSinceActive, 0)
		Expect(eligible).To(BeTrue())
	})

	It("should not be eligible when running duration is below minRunningSeconds", func() {
		lastActivity := int64(1_000_000_000_000)
		now := lastActivity + oneHourMs
		lastRunningTime := now - 60*1000 // running for only 60s
		eligible, _ := IsEligibleForPause(lastActivity, lastRunningTime, now, secondsSinceActive, 300)
		Expect(eligible).To(BeFalse())
	})

	It("should be eligible when running duration meets minRunningSeconds", func() {
		lastActivity := int64(1_000_000_000_000)
		now := lastActivity + oneHourMs
		lastRunningTime := now - 600*1000 // running for 600s
		eligible, _ := IsEligibleForPause(lastActivity, lastRunningTime, now, secondsSinceActive, 300)
		Expect(eligible).To(BeTrue())
	})

	It("should not be eligible when lastActivity is unknown (0)", func() {
		now := int64(1_000_000_000_000)
		eligible, _ := IsEligibleForPause(0, 0, now, secondsSinceActive, 0)
		Expect(eligible).To(BeFalse())
	})

	It("should not be eligible when minRunningSeconds is set but lastRunningTime is unknown", func() {
		lastActivity := int64(1_000_000_000_000)
		now := lastActivity + oneHourMs
		eligible, _ := IsEligibleForPause(lastActivity, 0, now, secondsSinceActive, 300)
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
