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

package options

import (
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestOptions(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "PodTemplateOptions Models Suite")
}

// imageConfigValue builds a CRD imageConfig value with the given id, labels, and admin-set hidden flag.
func imageConfigValue(id string, hidden bool, labels map[string]string) kubefloworgv1beta1.ImageConfigValue {
	return kubefloworgv1beta1.ImageConfigValue{
		Id: id,
		Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
			DisplayName: id,
			Hidden:      new(hidden),
			Labels:      spawnerLabelSlice(labels),
		},
	}
}

// podConfigValue builds a CRD podConfig value with the given id, labels, and admin-set hidden flag.
func podConfigValue(id string, hidden bool, labels map[string]string) kubefloworgv1beta1.PodConfigValue {
	return kubefloworgv1beta1.PodConfigValue{
		Id: id,
		Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
			DisplayName: id,
			Hidden:      new(hidden),
			Labels:      spawnerLabelSlice(labels),
		},
	}
}

func spawnerLabelSlice(m map[string]string) []kubefloworgv1beta1.OptionSpawnerLabel {
	result := make([]kubefloworgv1beta1.OptionSpawnerLabel, 0, len(m))
	for k, v := range m {
		result = append(result, kubefloworgv1beta1.OptionSpawnerLabel{Key: k, Value: v})
	}
	return result
}

// newWorkspaceKind builds a minimal WorkspaceKind with the given image/pod config values and filter rules.
func newWorkspaceKind(images []kubefloworgv1beta1.ImageConfigValue, pods []kubefloworgv1beta1.PodConfigValue, rules []kubefloworgv1beta1.FilterRule) *kubefloworgv1beta1.WorkspaceKind {
	return &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{Name: "test-wsk"},
		Spec: kubefloworgv1beta1.WorkspaceKindSpec{
			PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
				Options: kubefloworgv1beta1.WorkspaceKindPodOptions{
					ImageConfig: kubefloworgv1beta1.ImageConfig{
						Spawner: kubefloworgv1beta1.OptionsSpawnerConfig{Default: "img1"},
						Values:  images,
					},
					PodConfig: kubefloworgv1beta1.PodConfig{
						Spawner: kubefloworgv1beta1.OptionsSpawnerConfig{Default: "pod1"},
						Values:  pods,
					},
				},
			},
			FilterRules: rules,
		},
	}
}

// imageValueByID returns the response imageConfig value with the given id, or nil if omitted.
func imageValueByID(opts *PodTemplateOptions, id string) *ImageConfigValue {
	for i := range opts.ImageConfig.Values {
		if opts.ImageConfig.Values[i].Id == id {
			return &opts.ImageConfig.Values[i]
		}
	}
	return nil
}

// podValueByID returns the response podConfig value with the given id, or nil if omitted.
func podValueByID(opts *PodTemplateOptions, id string) *PodConfigValue {
	for i := range opts.PodConfig.Values {
		if opts.PodConfig.Values[i].Id == id {
			return &opts.PodConfig.Values[i]
		}
	}
	return nil
}

func uiHideRule(scope kubefloworgv1beta1.FilterRuleScope, match []kubefloworgv1beta1.FilterRuleMatch) kubefloworgv1beta1.FilterRule {
	return kubefloworgv1beta1.FilterRule{
		Scope:  scope,
		Effect: kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}},
		Match:  match,
	}
}

func matchImageConfig(labels map[string]string) kubefloworgv1beta1.FilterRuleMatch {
	return kubefloworgv1beta1.FilterRuleMatch{
		MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
			Selector: metav1.LabelSelector{MatchLabels: labels},
		},
	}
}

func matchPodConfig(labels map[string]string) kubefloworgv1beta1.FilterRuleMatch {
	return kubefloworgv1beta1.FilterRuleMatch{
		MatchPodConfig: &kubefloworgv1beta1.FilterRuleSelector{
			Selector: metav1.LabelSelector{MatchLabels: labels},
		},
	}
}

func matchNamespace(labels map[string]string) kubefloworgv1beta1.FilterRuleMatch {
	return kubefloworgv1beta1.FilterRuleMatch{
		MatchNamespace: &kubefloworgv1beta1.FilterRuleSelector{
			Selector: metav1.LabelSelector{MatchLabels: labels},
		},
	}
}

var _ = Describe("NewPodTemplateOptionsModelFromWorkspaceKind", func() {

	Context("no-rules default", func() {
		It("returns all values with admin-set hidden and non-restrictive restrictions", func() {
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{
					imageConfigValue("img1", false, nil),
					imageConfigValue("img2", true, nil),
				},
				[]kubefloworgv1beta1.PodConfigValue{podConfigValue("pod1", false, nil)},
				nil,
			)

			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(opts.ImageConfig.Values).To(HaveLen(2))

			img1 := imageValueByID(opts, "img1")
			Expect(img1).NotTo(BeNil())
			Expect(img1.Hidden).To(BeFalse())
			Expect(img1.Restrictions.Deny).To(BeFalse())

			// admin-set hidden is preserved when no rule matches
			img2 := imageValueByID(opts, "img2")
			Expect(img2).NotTo(BeNil())
			Expect(img2.Hidden).To(BeTrue())
			Expect(img2.Restrictions.Deny).To(BeFalse())

			Expect(opts.PodConfig.Values).To(HaveLen(1))
			pod1 := podValueByID(opts, "pod1")
			Expect(pod1).NotTo(BeNil())
			Expect(pod1.Hidden).To(BeFalse())
			Expect(pod1.Restrictions.Deny).To(BeFalse())
		})
	})

	Context("hidden merging", func() {
		It("merges admin-set hidden with the ui.hide effect (logical OR)", func() {
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{
					imageConfigValue("img1", false, map[string]string{"img-deprecated": "true"}),
					imageConfigValue("img2", true, nil),  // admin-hidden, no rule
					imageConfigValue("img3", false, nil), // neither
				},
				[]kubefloworgv1beta1.PodConfigValue{
					podConfigValue("pod1", false, map[string]string{"pod-deprecated": "true"}),
					podConfigValue("pod2", true, nil),  // admin-hidden, no rule
					podConfigValue("pod3", false, nil), // neither
				},
				[]kubefloworgv1beta1.FilterRule{
					uiHideRule(kubefloworgv1beta1.FilterRuleScopeImageConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchImageConfig(map[string]string{"img-deprecated": "true"}),
					}),
					uiHideRule(kubefloworgv1beta1.FilterRuleScopePodConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchPodConfig(map[string]string{"pod-deprecated": "true"}),
					}),
				},
			)

			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())

			Expect(imageValueByID(opts, "img1").Hidden).To(BeTrue()) // via ui.hide
			Expect(imageValueByID(opts, "img2").Hidden).To(BeTrue()) // via admin-set
			Expect(imageValueByID(opts, "img3").Hidden).To(BeFalse())

			Expect(podValueByID(opts, "pod1").Hidden).To(BeTrue()) // via ui.hide
			Expect(podValueByID(opts, "pod2").Hidden).To(BeTrue()) // via admin-set
			Expect(podValueByID(opts, "pod3").Hidden).To(BeFalse())
		})
	})

	Context("api.hide omission", func() {
		It("omits values whose matching rule has api.hide=true", func() {
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{
					imageConfigValue("img1", false, map[string]string{"img-eol": "true"}),
					imageConfigValue("img2", false, nil),
				},
				[]kubefloworgv1beta1.PodConfigValue{
					podConfigValue("pod1", false, map[string]string{"pod-eol": "true"}),
					podConfigValue("pod2", false, nil),
				},
				[]kubefloworgv1beta1.FilterRule{
					{
						Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
						Effect: kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}},
						Match:  []kubefloworgv1beta1.FilterRuleMatch{matchImageConfig(map[string]string{"img-eol": "true"})},
					},
					{
						Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
						Effect: kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}},
						Match:  []kubefloworgv1beta1.FilterRuleMatch{matchPodConfig(map[string]string{"pod-eol": "true"})},
					},
				},
			)

			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())

			Expect(opts.ImageConfig.Values).To(HaveLen(1))
			Expect(imageValueByID(opts, "img1")).To(BeNil())
			Expect(imageValueByID(opts, "img2")).NotTo(BeNil())

			Expect(opts.PodConfig.Values).To(HaveLen(1))
			Expect(podValueByID(opts, "pod1")).To(BeNil())
			Expect(podValueByID(opts, "pod2")).NotTo(BeNil())
		})
	})

	Context("api.deny + denyMessage", func() {
		It("returns the value with restrictions populated from the api.deny effect", func() {
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{
					imageConfigValue("img1", false, map[string]string{"img-eol": "true"}),
					imageConfigValue("img2", false, nil), // does not match the deny rule
				},
				[]kubefloworgv1beta1.PodConfigValue{
					podConfigValue("pod1", false, map[string]string{"pod-eol": "true"}),
					podConfigValue("pod2", false, nil), // does not match the deny rule
				},
				[]kubefloworgv1beta1.FilterRule{
					{
						Scope: kubefloworgv1beta1.FilterRuleScopeImageConfig,
						Effect: kubefloworgv1beta1.FilterRuleEffect{
							API: &kubefloworgv1beta1.FilterRuleEffectAPI{
								Deny:        new(true),
								DenyMessage: &kubefloworgv1beta1.FilterRuleDenyMessage{Text: "image is end-of-life"},
							},
						},
						Match: []kubefloworgv1beta1.FilterRuleMatch{matchImageConfig(map[string]string{"img-eol": "true"})},
					},
					{
						Scope: kubefloworgv1beta1.FilterRuleScopePodConfig,
						Effect: kubefloworgv1beta1.FilterRuleEffect{
							API: &kubefloworgv1beta1.FilterRuleEffectAPI{
								Deny:        new(true),
								DenyMessage: &kubefloworgv1beta1.FilterRuleDenyMessage{Text: "pod config is end-of-life"},
							},
						},
						Match: []kubefloworgv1beta1.FilterRuleMatch{matchPodConfig(map[string]string{"pod-eol": "true"})},
					},
				},
			)

			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())

			img1 := imageValueByID(opts, "img1")
			Expect(img1).NotTo(BeNil()) // deny keeps the value in the response
			Expect(img1.Restrictions.Deny).To(BeTrue())
			Expect(img1.Restrictions.DenyMessage).NotTo(BeNil())
			Expect(img1.Restrictions.DenyMessage.Text).To(Equal("image is end-of-life"))

			// non-matching image is returned without restrictions
			img2 := imageValueByID(opts, "img2")
			Expect(img2).NotTo(BeNil())
			Expect(img2.Restrictions.Deny).To(BeFalse())
			Expect(img2.Restrictions.DenyMessage).To(BeNil())

			pod1 := podValueByID(opts, "pod1")
			Expect(pod1).NotTo(BeNil()) // deny keeps the value in the response
			Expect(pod1.Restrictions.Deny).To(BeTrue())
			Expect(pod1.Restrictions.DenyMessage).NotTo(BeNil())
			Expect(pod1.Restrictions.DenyMessage.Text).To(Equal("pod config is end-of-life"))

			// non-matching pod config is returned without restrictions
			pod2 := podValueByID(opts, "pod2")
			Expect(pod2).NotTo(BeNil())
			Expect(pod2.Restrictions.Deny).To(BeFalse())
			Expect(pod2.Restrictions.DenyMessage).To(BeNil())
		})
	})

	Context("namespace matching", func() {
		It("applies a matchNamespace rule only when namespace labels satisfy the selector", func() {
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{imageConfigValue("img1", false, nil)},
				[]kubefloworgv1beta1.PodConfigValue{podConfigValue("pod1", false, nil)},
				[]kubefloworgv1beta1.FilterRule{
					uiHideRule(kubefloworgv1beta1.FilterRuleScopeImageConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchNamespace(map[string]string{"tier": "prod"}),
					}),
					uiHideRule(kubefloworgv1beta1.FilterRuleScopePodConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchNamespace(map[string]string{"tier": "prod"}),
					}),
				},
			)

			By("hiding when the namespace labels match")
			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, map[string]string{"tier": "prod"})
			Expect(err).NotTo(HaveOccurred())
			Expect(imageValueByID(opts, "img1").Hidden).To(BeTrue())
			Expect(podValueByID(opts, "pod1").Hidden).To(BeTrue())

			By("not hiding when the namespace labels do not match")
			opts, err = NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, map[string]string{"tier": "dev"})
			Expect(err).NotTo(HaveOccurred())
			Expect(imageValueByID(opts, "img1").Hidden).To(BeFalse())
			Expect(podValueByID(opts, "pod1").Hidden).To(BeFalse())

			By("not hiding when no namespace context is provided (nil labels)")
			opts, err = NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(imageValueByID(opts, "img1").Hidden).To(BeFalse())
			Expect(podValueByID(opts, "pod1").Hidden).To(BeFalse())
		})
	})

	Context("cross-option matching", func() {
		It("hides a podConfig based on the imageConfig selected in the request context", func() {
			// rule: hide any non-GPU podConfig when an NVIDIA image is selected
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{
					imageConfigValue("nvidia-img", false, map[string]string{"vendor": "nvidia"}),
				},
				[]kubefloworgv1beta1.PodConfigValue{
					podConfigValue("cpu-pod", false, map[string]string{"gpu": "false"}),
					podConfigValue("gpu-pod", false, map[string]string{"gpu": "true"}),
				},
				[]kubefloworgv1beta1.FilterRule{
					uiHideRule(kubefloworgv1beta1.FilterRuleScopePodConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchImageConfig(map[string]string{"vendor": "nvidia"}),
						matchPodConfig(map[string]string{"gpu": "false"}),
					}),
				},
			)

			By("hiding the cpu podConfig when the nvidia image is selected in context")
			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{
				Context: ListValuesContext{ImageConfig: &ContextImageConfig{Id: "nvidia-img"}},
			}, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(podValueByID(opts, "cpu-pod").Hidden).To(BeTrue())
			Expect(podValueByID(opts, "gpu-pod").Hidden).To(BeFalse())

			By("not hiding any podConfig when no imageConfig context is provided")
			opts, err = NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(podValueByID(opts, "cpu-pod").Hidden).To(BeFalse())
			Expect(podValueByID(opts, "gpu-pod").Hidden).To(BeFalse())
		})
	})

	Context("first-match-wins ordering", func() {
		It("applies only the first matching rule's effect per value", func() {
			wsk := newWorkspaceKind(
				[]kubefloworgv1beta1.ImageConfigValue{
					imageConfigValue("img1", false, map[string]string{"img-gpu": "true"}),
				},
				[]kubefloworgv1beta1.PodConfigValue{
					podConfigValue("pod1", false, map[string]string{"pod-gpu": "true"}),
				},
				[]kubefloworgv1beta1.FilterRule{
					// first image rule: ui.hide
					uiHideRule(kubefloworgv1beta1.FilterRuleScopeImageConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchImageConfig(map[string]string{"img-gpu": "true"}),
					}),
					// second image rule (never reached): api.deny
					{
						Scope:  kubefloworgv1beta1.FilterRuleScopeImageConfig,
						Effect: kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Deny: new(true)}},
						Match:  []kubefloworgv1beta1.FilterRuleMatch{matchImageConfig(map[string]string{"img-gpu": "true"})},
					},
					// first pod rule: ui.hide
					uiHideRule(kubefloworgv1beta1.FilterRuleScopePodConfig, []kubefloworgv1beta1.FilterRuleMatch{
						matchPodConfig(map[string]string{"pod-gpu": "true"}),
					}),
					// second pod rule (never reached): api.deny
					{
						Scope:  kubefloworgv1beta1.FilterRuleScopePodConfig,
						Effect: kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Deny: new(true)}},
						Match:  []kubefloworgv1beta1.FilterRuleMatch{matchPodConfig(map[string]string{"pod-gpu": "true"})},
					},
				},
			)

			opts, err := NewPodTemplateOptionsModelFromWorkspaceKind(wsk, &ListValuesRequest{}, nil)
			Expect(err).NotTo(HaveOccurred())

			img1 := imageValueByID(opts, "img1")
			Expect(img1).NotTo(BeNil())
			Expect(img1.Hidden).To(BeTrue())             // first rule applied
			Expect(img1.Restrictions.Deny).To(BeFalse()) // second rule never reached

			pod1 := podValueByID(opts, "pod1")
			Expect(pod1).NotTo(BeNil())
			Expect(pod1.Hidden).To(BeTrue())             // first rule applied
			Expect(pod1.Restrictions.Deny).To(BeFalse()) // second rule never reached
		})
	})
})
