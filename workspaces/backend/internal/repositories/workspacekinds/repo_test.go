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
	"context"
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	modelsPodTemplateOptions "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

func TestWorkspaceKindRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "WorkspaceKinds Repository Suite")
}

var _ = Describe("WorkspaceKindRepository.GetWorkspaceKinds", func() {
	var (
		ctx    context.Context
		scheme *runtime.Scheme
	)

	BeforeEach(func() {
		ctx = context.Background()
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
	})

	// newWSK builds a minimal WorkspaceKind with the given name, admin-set hidden flag, and filterRules.
	newWSK := func(name string, hidden bool, rules []kubefloworgv1beta1.FilterRule) *kubefloworgv1beta1.WorkspaceKind {
		return &kubefloworgv1beta1.WorkspaceKind{
			Name: name,
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				Spawner:     kubefloworgv1beta1.WorkspaceKindSpawner{Hidden: new(hidden)},
				FilterRules: rules,
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					Options: kubefloworgv1beta1.WorkspaceKindPodOptions{
						ImageConfig: kubefloworgv1beta1.ImageConfig{
							Spawner: kubefloworgv1beta1.OptionsSpawnerConfig{Default: "img1"},
							Values: []kubefloworgv1beta1.ImageConfigValue{
								{Id: "img1", Spawner: kubefloworgv1beta1.OptionSpawnerInfo{DisplayName: "img1"}},
							},
						},
						PodConfig: kubefloworgv1beta1.PodConfig{
							Spawner: kubefloworgv1beta1.OptionsSpawnerConfig{Default: "pod1"},
							Values: []kubefloworgv1beta1.PodConfigValue{
								{Id: "pod1", Spawner: kubefloworgv1beta1.OptionSpawnerInfo{DisplayName: "pod1"}},
							},
						},
					},
				},
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

	prodNamespace := &corev1.Namespace{
		Name: "prod-ns", Labels: map[string]string{"tier": "prod"},
	}

	// newRepo builds a repository backed by a fake client seeded with the given objects.
	newRepo := func(objs ...client.Object) *WorkspaceKindRepository {
		cl := fake.NewClientBuilder().WithScheme(scheme).WithObjects(objs...).Build()
		return NewWorkspaceKindRepository(&config.EnvConfig{}, cl, cl)
	}

	Context("no-namespaceFilter mode (admin listing)", func() {
		It("returns all WorkspaceKinds without evaluating rules", func() {
			wsk := newWSK("wsk-a", true, []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}}),
			})
			repo := newRepo(wsk, prodNamespace)

			items, err := repo.GetWorkspaceKinds(ctx, "")
			Expect(err).NotTo(HaveOccurred())

			// even though an api.hide rule matches prod, no namespaceFilter => not evaluated
			Expect(items).To(HaveLen(1))
			Expect(items[0].Name).To(Equal("wsk-a"))
			Expect(items[0].Hidden).To(BeTrue()) // admin-set value preserved
			Expect(items[0].Restrictions).To(BeComparableTo(common.DefaultRestrictions()))
		})
	})

	Context("namespace matching (ui.hide)", func() {
		It("merges admin-set hidden with the ui.hide effect when namespace labels match", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}}),
			}
			repo := newRepo(newWSK("wsk-a", false, rules), prodNamespace)

			items, err := repo.GetWorkspaceKinds(ctx, "prod-ns")
			Expect(err).NotTo(HaveOccurred())
			Expect(items).To(HaveLen(1))
			Expect(items[0].Hidden).To(BeTrue())
		})

		It("returns a validation error when the namespaceFilter references a non-existent namespace", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}}),
			}
			repo := newRepo(newWSK("wsk-a", false, rules))

			items, err := repo.GetWorkspaceKinds(ctx, "missing-ns")
			Expect(err).To(HaveOccurred())
			Expect(helper.IsInternalValidationError(err)).To(BeTrue())
			Expect(items).To(BeNil())

			// the error must point at the caller's user-facing query param, not a generic "namespace"
			fieldErrs := helper.FieldErrorsFromInternalValidationError(err)
			Expect(fieldErrs).To(HaveLen(1))
			Expect(fieldErrs[0].Field).To(Equal(constants.NamespaceFilterQueryParam))
		})
	})

	Context("api.hide omission", func() {
		It("omits the WorkspaceKind from the response when a matching rule sets api.hide", func() {
			hiddenWSK := newWSK("wsk-hidden", false, []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}}),
			})
			visibleWSK := newWSK("wsk-visible", false, nil)
			repo := newRepo(hiddenWSK, visibleWSK, prodNamespace)

			items, err := repo.GetWorkspaceKinds(ctx, "prod-ns")
			Expect(err).NotTo(HaveOccurred())

			Expect(items).To(HaveLen(1))
			Expect(items[0].Name).To(Equal("wsk-visible"))
		})
	})

	Context("api.deny", func() {
		It("returns the WorkspaceKind with restrictions populated from the api.deny effect", func() {
			rules := []kubefloworgv1beta1.FilterRule{
				wskRule(map[string]string{"tier": "prod"},
					kubefloworgv1beta1.FilterRuleEffect{
						API: &kubefloworgv1beta1.FilterRuleEffectAPI{
							Deny:        new(true),
							DenyMessage: &kubefloworgv1beta1.FilterRuleDenyMessage{Text: "not allowed in prod"},
						},
					}),
			}
			repo := newRepo(newWSK("wsk-a", false, rules), prodNamespace)

			items, err := repo.GetWorkspaceKinds(ctx, "prod-ns")
			Expect(err).NotTo(HaveOccurred())
			Expect(items).To(HaveLen(1))
			Expect(items[0].Restrictions).To(BeComparableTo(common.Restrictions{
				Deny:        true,
				DenyMessage: &common.DenyMessage{Text: "not allowed in prod"},
			}))
		})
	})

	Context("ListPodTemplateOptionsValues namespace context", func() {
		It("returns a validation error naming context.namespace.name when the namespace does not exist", func() {
			repo := newRepo(newWSK("wsk-a", false, nil))

			request := &modelsPodTemplateOptions.ListValuesRequest{
				Context: modelsPodTemplateOptions.ListValuesContext{
					Namespace: &modelsPodTemplateOptions.ContextNamespace{Name: "missing-ns"},
				},
			}

			values, err := repo.ListPodTemplateOptionsValues(ctx, "wsk-a", request)
			Expect(err).To(HaveOccurred())
			Expect(helper.IsInternalValidationError(err)).To(BeTrue())
			Expect(values).To(BeNil())

			// the error must point at the caller's request body field, not a generic "namespace"
			fieldErrs := helper.FieldErrorsFromInternalValidationError(err)
			Expect(fieldErrs).To(HaveLen(1))
			Expect(fieldErrs[0].Field).To(Equal("context.namespace.name"))
		})
	})
})
