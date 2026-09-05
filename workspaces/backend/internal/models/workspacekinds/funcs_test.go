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
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

var (
	testPodExecTimeoutSeconds     int32 = 45
	testMinProbeIntervalSeconds   int32 = 120
	testProbeIntervalSeconds      int32 = 1800
	testRuleSecondsSinceActive    int32 = 3600
	testRuleMinRunningSeconds     int32 = 300
	testRuleSecondsSinceActiveMax int32 = 86400
)

func TestWorkspaceKinds(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "WorkspaceKinds Models Suite")
}

var _ = Describe("NewWorkspaceKindModelFromWorkspaceKind", func() {
	It("initializes empty StatefulSetMetadata maps when the CRD field is nil", func() {
		wsk := &kubefloworgv1beta1.WorkspaceKind{
			Name: "no-metadata",
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					PodMetadata:         nil,
					StatefulSetMetadata: nil,
				},
			},
		}

		item, apiHide := NewWorkspaceKindModelFromWorkspaceKind(nil, wsk, nil)

		Expect(apiHide).To(BeFalse())
		Expect(item.PodTemplate.StatefulSetMetadata.Labels).NotTo(BeNil())
		Expect(item.PodTemplate.StatefulSetMetadata.Labels).To(BeEmpty())
		Expect(item.PodTemplate.StatefulSetMetadata.Annotations).NotTo(BeNil())
		Expect(item.PodTemplate.StatefulSetMetadata.Annotations).To(BeEmpty())
	})

	It("copies StatefulSetMetadata maps without aliasing the CRD maps", func() {
		wsk := &kubefloworgv1beta1.WorkspaceKind{
			Name: "with-metadata",
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					StatefulSetMetadata: &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
						Labels:      map[string]string{"my-sts-label": "my-value"},
						Annotations: map[string]string{"my-sts-annotation": "my-value"},
					},
				},
			},
		}

		item, apiHide := NewWorkspaceKindModelFromWorkspaceKind(nil, wsk, nil)

		Expect(apiHide).To(BeFalse())
		Expect(item.PodTemplate.StatefulSetMetadata.Labels).To(HaveKeyWithValue("my-sts-label", "my-value"))
		Expect(item.PodTemplate.StatefulSetMetadata.Annotations).To(HaveKeyWithValue("my-sts-annotation", "my-value"))

		// mutating the copied maps must not affect the source WorkspaceKind
		item.PodTemplate.StatefulSetMetadata.Labels["my-sts-label"] = "mutated"
		Expect(wsk.Spec.PodTemplate.StatefulSetMetadata.Labels["my-sts-label"]).To(Equal("my-value"))
		item.PodTemplate.StatefulSetMetadata.Annotations["my-sts-annotation"] = "mutated"
		Expect(wsk.Spec.PodTemplate.StatefulSetMetadata.Annotations["my-sts-annotation"]).To(Equal("my-value"))
	})
})

var _ = Describe("buildActivityProbe", func() {
	It("returns nil when probe is nil", func() {
		Expect(buildActivityProbe(nil)).To(BeNil())
	})

	It("converts a PodExec probe with default intervals", func() {
		crdProbe := &kubefloworgv1beta1.ActivityProbe{
			PodExec: &kubefloworgv1beta1.ActivityProbePodExec{
				TimeoutSeconds: &testPodExecTimeoutSeconds,
				Script:         "#!/bin/bash\necho active",
			},
		}

		apiProbe := buildActivityProbe(crdProbe)
		Expect(apiProbe).NotTo(BeNil())
		Expect(apiProbe.MinProbeIntervalSeconds).To(Equal(kubefloworgv1beta1.DefaultMinProbeIntervalSeconds))
		Expect(apiProbe.ProbeIntervalSeconds).To(Equal(kubefloworgv1beta1.DefaultProbeIntervalSeconds))
		Expect(apiProbe.PodExec).NotTo(BeNil())
		Expect(apiProbe.PodExec.TimeoutSeconds).To(Equal(testPodExecTimeoutSeconds))
		Expect(apiProbe.Jupyter).To(BeNil())
	})

	It("converts a Jupyter probe with custom intervals", func() {
		crdProbe := &kubefloworgv1beta1.ActivityProbe{
			MinProbeIntervalSeconds: &testMinProbeIntervalSeconds,
			ProbeIntervalSeconds:    &testProbeIntervalSeconds,
			Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{
				LastActivity: true,
				PortId:       "jupyterlab",
			},
		}

		apiProbe := buildActivityProbe(crdProbe)
		Expect(apiProbe).NotTo(BeNil())
		Expect(apiProbe.MinProbeIntervalSeconds).To(Equal(testMinProbeIntervalSeconds))
		Expect(apiProbe.ProbeIntervalSeconds).To(Equal(testProbeIntervalSeconds))
		Expect(apiProbe.Jupyter).NotTo(BeNil())
		Expect(apiProbe.Jupyter.LastActivity).To(BeTrue())
		Expect(apiProbe.Jupyter.PortId).To(Equal("jupyterlab"))
		Expect(apiProbe.PodExec).To(BeNil())
	})
})

var _ = Describe("buildActivityRules", func() {
	It("returns nil when rules are empty", func() {
		Expect(buildActivityRules(nil)).To(BeNil())
		Expect(buildActivityRules([]kubefloworgv1beta1.ActivityRule{})).To(BeNil())
	})

	It("converts activity rules correctly", func() {
		crdRules := []kubefloworgv1beta1.ActivityRule{
			{
				Config: kubefloworgv1beta1.ActivityRuleConfig{
					SecondsSinceActive: testRuleSecondsSinceActive,
					MinRunningSeconds:  &testRuleMinRunningSeconds,
				},
				Match: &kubefloworgv1beta1.ActivityRuleMatch{
					MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
						Selector: metav1.LabelSelector{
							MatchLabels: map[string]string{"tier": "dev"},
						},
					},
					MatchPodConfig: &kubefloworgv1beta1.PodConfigMatch{
						Selector: metav1.LabelSelector{
							MatchLabels: map[string]string{"gpu": "true"},
						},
					},
				},
				Effect: kubefloworgv1beta1.ActivityRuleEffect{
					PauseWorkspace: new(true),
				},
			},
			{
				Config: kubefloworgv1beta1.ActivityRuleConfig{
					SecondsSinceActive: testRuleSecondsSinceActiveMax,
				},
				Effect: kubefloworgv1beta1.ActivityRuleEffect{
					PauseWorkspace: new(true),
				},
			},
		}

		apiRules := buildActivityRules(crdRules)
		Expect(apiRules).To(HaveLen(2))

		Expect(apiRules[0].Config.SecondsSinceActive).To(Equal(testRuleSecondsSinceActive))
		Expect(apiRules[0].Config.MinRunningSeconds).To(Equal(testRuleMinRunningSeconds))
		Expect(apiRules[0].Match).NotTo(BeNil())
		Expect(apiRules[0].Match.MatchNamespace).NotTo(BeNil())
		Expect(apiRules[0].Match.MatchNamespace.Selector.MatchLabels).To(HaveKeyWithValue("tier", "dev"))
		Expect(apiRules[0].Match.MatchPodConfig).NotTo(BeNil())
		Expect(apiRules[0].Match.MatchPodConfig.Selector.MatchLabels).To(HaveKeyWithValue("gpu", "true"))
		Expect(apiRules[0].Effect.PauseWorkspace).To(BeTrue())

		// Verify deep copy of label selector maps
		apiRules[0].Match.MatchNamespace.Selector.MatchLabels["tier"] = "mutated"
		Expect(crdRules[0].Match.MatchNamespace.Selector.MatchLabels["tier"]).To(Equal("dev"))
		apiRules[0].Match.MatchPodConfig.Selector.MatchLabels["gpu"] = "false"
		Expect(crdRules[0].Match.MatchPodConfig.Selector.MatchLabels["gpu"]).To(Equal("true"))

		Expect(apiRules[1].Config.SecondsSinceActive).To(Equal(testRuleSecondsSinceActiveMax))
		Expect(apiRules[1].Config.MinRunningSeconds).To(Equal(int32(0)))
		Expect(apiRules[1].Match).To(BeNil())
		Expect(apiRules[1].Effect.PauseWorkspace).To(BeTrue())
	})
})

var _ = Describe("NewWorkspaceKindModelFromWorkspaceKind", func() {
	cfg := &config.EnvConfig{}

	// newWSK builds a minimal WorkspaceKind with the given admin-set hidden flag and filterRules.
	newWSK := func(hidden bool, rules []kubefloworgv1beta1.FilterRule) *kubefloworgv1beta1.WorkspaceKind {
		return &kubefloworgv1beta1.WorkspaceKind{
			Name: "test-wsk",
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				Spawner:     kubefloworgv1beta1.WorkspaceKindSpawner{Hidden: new(hidden)},
				FilterRules: rules,
			},
		}
	}

	// wskRule builds a WORKSPACE_KIND-scoped rule that matches namespaces with the given labels.
	wskRule := func(nsSelector map[string]string, effect kubefloworgv1beta1.FilterRuleEffect) kubefloworgv1beta1.FilterRule {
		return kubefloworgv1beta1.FilterRule{
			Scope:  kubefloworgv1beta1.FilterRuleScopeWorkspaceKind,
			Effect: effect,
			Match: []kubefloworgv1beta1.FilterRuleMatch{
				{
					MatchNamespace: &kubefloworgv1beta1.FilterRuleSelector{
						Selector: metav1.LabelSelector{MatchLabels: nsSelector},
					},
				},
			},
		}
	}

	Context("admin listing (no namespaceFilter)", func() {
		It("does not apply matchNamespace rules: hidden is admin-set and deny is not set", func() {
			wsk := newWSK(true, []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Deny: new(true)}}),
			})

			// namespaceLabels is nil, so the matchNamespace condition cannot fire => no deny
			item, apiHide := NewWorkspaceKindModelFromWorkspaceKind(cfg, wsk, nil)

			Expect(apiHide).To(BeFalse())
			Expect(item.Hidden).To(BeTrue()) // admin-set value preserved
			Expect(item.Restrictions.Deny).To(BeFalse())
			Expect(item.Restrictions).To(BeComparableTo(common.DefaultRestrictions()))
		})
	})

	Context("ui.hide via matchNamespace", func() {
		It("merges admin-set hidden with the ui.hide effect (logical OR)", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}}),
			}

			By("hiding when the namespace labels match")
			item, apiHide := NewWorkspaceKindModelFromWorkspaceKind(cfg, newWSK(false, rules), map[string]string{"tier": "prod"})
			Expect(apiHide).To(BeFalse())
			Expect(item.Hidden).To(BeTrue())

			By("not hiding when the namespace labels do not match")
			item, _ = NewWorkspaceKindModelFromWorkspaceKind(cfg, newWSK(false, rules), map[string]string{"tier": "dev"})
			Expect(item.Hidden).To(BeFalse())

			By("still hidden when admin-set even though the rule does not match")
			item, _ = NewWorkspaceKindModelFromWorkspaceKind(cfg, newWSK(true, rules), map[string]string{"tier": "dev"})
			Expect(item.Hidden).To(BeTrue())
		})
	})

	Context("api.hide via matchNamespace", func() {
		It("signals the WorkspaceKind should be omitted from the response", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}}),
			}

			item, apiHide := NewWorkspaceKindModelFromWorkspaceKind(cfg, newWSK(false, rules), map[string]string{"tier": "prod"})
			Expect(apiHide).To(BeTrue())
			Expect(item).To(BeComparableTo(WorkspaceKindListItem{}))
		})
	})

	Context("api.deny via matchNamespace", func() {
		It("populates restrictions with deny and denyMessage", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{
						API: &kubefloworgv1beta1.FilterRuleEffectAPI{
							Deny:        new(true),
							DenyMessage: &kubefloworgv1beta1.FilterRuleDenyMessage{Text: "not allowed in prod"},
						},
					}),
			}

			By("denying when the namespace labels match")
			item, apiHide := NewWorkspaceKindModelFromWorkspaceKind(cfg, newWSK(false, rules), map[string]string{"tier": "prod"})
			Expect(apiHide).To(BeFalse())
			Expect(item.Restrictions).To(BeComparableTo(common.Restrictions{
				Deny:        true,
				DenyMessage: &common.DenyMessage{Text: "not allowed in prod"},
			}))

			By("not denying when the namespace labels do not match")
			item, _ = NewWorkspaceKindModelFromWorkspaceKind(cfg, newWSK(false, rules), map[string]string{"tier": "dev"})
			Expect(item.Restrictions).To(BeComparableTo(common.DefaultRestrictions()))
		})
	})
})
