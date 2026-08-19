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

package filterrules

import (
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

func TestFilterRules(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "FilterRules Engine Suite")
}

// spawnerLabels converts a map into the CRD spawner label slice used by EvalTarget.
func spawnerLabels(m map[string]string) []kubefloworgv1beta1.OptionSpawnerLabel {
	result := make([]kubefloworgv1beta1.OptionSpawnerLabel, 0, len(m))
	for k, v := range m {
		result = append(result, kubefloworgv1beta1.OptionSpawnerLabel{Key: k, Value: v})
	}
	return result
}

// evaluateRules compiles the given rules into the eval context and runs Evaluate, so the
// tests can keep expressing cases as (rules, target, context).
func evaluateRules(rules []kubefloworgv1beta1.FilterRule, target EvalTarget, evalCtx EvalContext) EvalResult {
	evalCtx.compiledRules = compileRules(rules)
	return Evaluate(target, evalCtx)
}

// matchLabelsRule builds a single-condition FilterRule with the given scope, match condition
// (via the provided FilterRuleMatch), and effect.
func matchImageConfigRule(selector map[string]string, effect kubefloworgv1beta1.FilterRuleEffect) kubefloworgv1beta1.FilterRule {
	return kubefloworgv1beta1.FilterRule{
		Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
		Effect: effect,
		Match: []kubefloworgv1beta1.FilterRuleMatch{
			{
				MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
					Selector: metav1.LabelSelector{MatchLabels: selector},
				},
			},
		},
	}
}

var _ = Describe("spawnerLabelsToMap", func() {
	It("returns a non-nil empty map for no labels", func() {
		result := spawnerLabelsToMap(nil)
		Expect(result).NotTo(BeNil())
		Expect(result).To(BeEmpty())
	})

	It("converts a slice of spawner labels into a map", func() {
		result := spawnerLabelsToMap([]kubefloworgv1beta1.OptionSpawnerLabel{
			{Key: "gpu", Value: "true"},
			{Key: "vendor", Value: "nvidia"},
		})
		Expect(result).To(HaveKeyWithValue("gpu", "true"))
		Expect(result).To(HaveKeyWithValue("vendor", "nvidia"))
	})
})

var _ = Describe("Evaluate", func() {
	Context("when no rules are provided", func() {
		It("returns the non-restrictive default", func() {
			result := evaluateRules(nil, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("scope filtering", func() {
		It("ignores rules whose scope does not match the target", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				{
					Scope: kubefloworgv1beta1.FilterRuleScopePodConfig,
					Effect: kubefloworgv1beta1.FilterRuleEffect{
						UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true},
					},
					Match: []kubefloworgv1beta1.FilterRuleMatch{
						{
							MatchPodConfig: &kubefloworgv1beta1.FilterRuleSelector{
								Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "true"}},
							},
						},
					},
				},
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("ui.hide effect", func() {
		It("sets UIHide when a same-scope rule matches", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"gpu": "true"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				),
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))
		})

		It("does not match when labels differ", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"gpu": "true"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				),
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "false"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("api.hide effect", func() {
		It("sets APIHide when a matching rule has api.hide=true", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"deprecated": "true"},
					kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}},
				),
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"deprecated": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{APIHide: true, Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("api.deny effect", func() {
		It("populates Restrictions with deny and denyMessage", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"eol": "true"},
					kubefloworgv1beta1.FilterRuleEffect{
						API: &kubefloworgv1beta1.FilterRuleEffectAPI{
							Deny:        new(true),
							DenyMessage: &kubefloworgv1beta1.FilterRuleDenyMessage{Text: "image is end-of-life"},
						},
					},
				),
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"eol": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{
				Restrictions: common.Restrictions{
					Deny:        true,
					DenyMessage: &common.DenyMessage{Text: "image is end-of-life"},
				},
			}))
		})

		It("does not set a denyMessage when deny is false", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"eol": "true"},
					kubefloworgv1beta1.FilterRuleEffect{
						API: &kubefloworgv1beta1.FilterRuleEffectAPI{Deny: new(false)},
					},
				),
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"eol": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("AND logic across multiple match conditions", func() {
		It("matches only when ALL conditions are satisfied", func() {
			rule := kubefloworgv1beta1.FilterRule{
				Scope: kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{
					UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true},
				},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					{
						MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "true"}},
						},
					},
					{
						MatchNamespace: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"tier": "prod"}},
						},
					},
				},
			}

			By("matching when both conditions are satisfied")
			result := evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{NamespaceLabels: map[string]string{"tier": "prod"}})
			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))

			By("not matching when only one condition is satisfied")
			result = evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{NamespaceLabels: map[string]string{"tier": "dev"}})
			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("namespace matching", func() {
		It("treats matchNamespace as non-matching when namespace labels are absent", func() {
			rule := kubefloworgv1beta1.FilterRule{
				Scope: kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{
					UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true},
				},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					{
						MatchNamespace: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"tier": "prod"}},
						},
					},
				},
			}

			result := evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{NamespaceLabels: nil})

			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("cross-option matching", func() {
		It("evaluates matchPodConfig against the request-selected podConfig for an IMAGE_CONFIG rule", func() {
			// selecting a non-NVIDIA podConfig should deny an NVIDIA-only image
			rule := kubefloworgv1beta1.FilterRule{
				Scope: kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{
					API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)},
				},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					{
						MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"vendor": "nvidia"}},
						},
					},
					{
						MatchPodConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "false"}},
						},
					},
				},
			}

			By("hiding the NVIDIA image when a non-GPU podConfig is selected")
			result := evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"vendor": "nvidia"}),
			}, EvalContext{PodConfigLabels: map[string]string{"gpu": "false"}})
			Expect(result).To(BeComparableTo(EvalResult{APIHide: true, Restrictions: common.DefaultRestrictions()}))

			By("not hiding the NVIDIA image when no podConfig context is present")
			result = evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"vendor": "nvidia"}),
			}, EvalContext{PodConfigLabels: nil})
			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("first-match-wins ordering", func() {
		It("applies only the effect of the first matching rule", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"gpu": "true"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				),
				matchImageConfigRule(
					map[string]string{"gpu": "true"},
					kubefloworgv1beta1.FilterRuleEffect{
						API: &kubefloworgv1beta1.FilterRuleEffectAPI{Deny: new(true)},
					},
				),
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})

			// only the first rule (ui.hide) applies; the second (api.deny) is never reached
			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("matchImageConfig on a same-scope IMAGE_CONFIG target", func() {
		It("evaluates against the target's own labels", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				matchImageConfigRule(
					map[string]string{"vendor": "nvidia"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				),
			}

			// even with a conflicting cross-option label in context, the same-scope target labels are used
			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"vendor": "nvidia"}),
			}, EvalContext{ImageConfigLabels: map[string]string{"vendor": "other"}})

			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("matchPodConfig cross-option on an IMAGE_CONFIG target", func() {
		It("evaluates against the request-selected podConfig labels", func() {
			rule := kubefloworgv1beta1.FilterRule{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					{
						MatchPodConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "false"}},
						},
					},
				},
			}

			By("matching when the selected podConfig labels satisfy the selector")
			result := evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"vendor": "nvidia"}),
			}, EvalContext{PodConfigLabels: map[string]string{"gpu": "false"}})
			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))

			By("not matching when no podConfig context is present")
			result = evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"vendor": "nvidia"}),
			}, EvalContext{PodConfigLabels: nil})
			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("POD_CONFIG target with same-scope and cross-option conditions", func() {
		It("uses target labels for matchPodConfig and context labels for matchImageConfig", func() {
			rule := kubefloworgv1beta1.FilterRule{
				Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					{
						MatchPodConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "false"}},
						},
					},
					{
						MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"vendor": "nvidia"}},
						},
					},
				},
			}

			result := evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "false"}), // target's own labels (matchPodConfig)
			}, EvalContext{ImageConfigLabels: map[string]string{"vendor": "nvidia"}}) // cross-option (matchImageConfig)

			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("empty match condition", func() {
		It("drops a match with no selector set, so a rule with only that condition never fires", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				{
					Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
					Effect: kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
					Match:  []kubefloworgv1beta1.FilterRuleMatch{{}}, // none of the three selectors set
				},
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})

			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})

	Context("invalid selector", func() {
		badMatchImageConfig := kubefloworgv1beta1.FilterRuleMatch{
			MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
				Selector: metav1.LabelSelector{
					MatchExpressions: []metav1.LabelSelectorRequirement{
						{
							Key:      "gpu",
							Operator: metav1.LabelSelectorOperator("BadOperator"),
							Values:   []string{"true"},
						},
					},
				},
			},
		}

		It("ignores the invalid condition but still evaluates the remaining conditions", func() {
			rule := kubefloworgv1beta1.FilterRule{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					badMatchImageConfig,
					{
						MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{MatchLabels: map[string]string{"gpu": "true"}},
						},
					},
				},
			}

			By("matching when the remaining valid condition is satisfied")
			result := evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})
			Expect(result).To(BeComparableTo(EvalResult{UIHide: true, Restrictions: common.DefaultRestrictions()}))

			By("not matching when the remaining valid condition is not satisfied")
			result = evaluateRules([]kubefloworgv1beta1.FilterRule{rule}, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "false"}),
			}, EvalContext{})
			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})

		It("drops the rule entirely when the invalid condition is its only condition", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				{
					Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
					Effect: kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
					Match:  []kubefloworgv1beta1.FilterRuleMatch{badMatchImageConfig},
				},
			}

			result := evaluateRules(rules, EvalTarget{
				Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Labels: spawnerLabels(map[string]string{"gpu": "true"}),
			}, EvalContext{})

			// the rule has no valid conditions left, so it is dropped and never fires
			Expect(result).To(BeComparableTo(EvalResult{Restrictions: common.DefaultRestrictions()}))
		})
	})
})

var _ = Describe("BuildEvalContext", func() {
	newWSK := func() *kubefloworgv1beta1.WorkspaceKind {
		return &kubefloworgv1beta1.WorkspaceKind{
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				FilterRules: []kubefloworgv1beta1.FilterRule{
					matchImageConfigRule(
						map[string]string{"gpu": "true"},
						kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
					),
				},
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					Options: kubefloworgv1beta1.WorkspaceKindPodOptions{
						ImageConfig: kubefloworgv1beta1.ImageConfig{
							Values: []kubefloworgv1beta1.ImageConfigValue{
								{
									Id: "img1",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										Labels: []kubefloworgv1beta1.OptionSpawnerLabel{{Key: "vendor", Value: "nvidia"}},
									},
								},
							},
						},
						PodConfig: kubefloworgv1beta1.PodConfig{
							Values: []kubefloworgv1beta1.PodConfigValue{
								{
									Id: "pod1",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										Labels: []kubefloworgv1beta1.OptionSpawnerLabel{{Key: "gpu", Value: "true"}},
									},
								},
							},
						},
					},
				},
			},
		}
	}

	It("passes through namespace labels and leaves config labels nil when no ids are given", func() {
		evalCtx := BuildEvalContext(newWSK(), map[string]string{"tier": "prod"}, "", "")

		Expect(evalCtx.NamespaceLabels).To(HaveKeyWithValue("tier", "prod"))
		Expect(evalCtx.ImageConfigLabels).To(BeNil())
		Expect(evalCtx.PodConfigLabels).To(BeNil())
	})

	It("compiles the WorkspaceKind's filterRules into the eval context", func() {
		evalCtx := BuildEvalContext(newWSK(), nil, "", "")

		Expect(evalCtx.compiledRules).To(HaveLen(1))
		cr := evalCtx.compiledRules[0]
		Expect(cr.rule.Scope).To(Equal(kubefloworgv1beta1.FilterRuleScopeImageConfig))
		Expect(cr.matches).To(HaveLen(1))
		Expect(cr.matches[0].selector).NotTo(BeNil())
		Expect(cr.matches[0].selector.Matches(labels.Set{"gpu": "true"})).To(BeTrue())
		Expect(cr.matches[0].selector.Matches(labels.Set{"gpu": "false"})).To(BeFalse())
	})

	It("leaves compiledRules empty when the WorkspaceKind has no filterRules", func() {
		wsk := newWSK()
		wsk.Spec.FilterRules = nil
		evalCtx := BuildEvalContext(wsk, nil, "", "")

		Expect(evalCtx.compiledRules).To(BeEmpty())
	})

	It("resolves imageConfig and podConfig labels from matching ids", func() {
		evalCtx := BuildEvalContext(newWSK(), nil, "img1", "pod1")

		Expect(evalCtx.ImageConfigLabels).To(HaveKeyWithValue("vendor", "nvidia"))
		Expect(evalCtx.PodConfigLabels).To(HaveKeyWithValue("gpu", "true"))
	})

	It("leaves labels nil when the ids do not match any value", func() {
		evalCtx := BuildEvalContext(newWSK(), nil, "missing-img", "missing-pod")

		Expect(evalCtx.ImageConfigLabels).To(BeNil())
		Expect(evalCtx.PodConfigLabels).To(BeNil())
	})
})
