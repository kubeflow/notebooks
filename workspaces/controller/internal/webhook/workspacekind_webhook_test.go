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

package webhook

import (
	"slices"
	"strings"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	gomegaTypes "github.com/onsi/gomega/types"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("WorkspaceKind Webhook", func() {

	const (
		namespaceName = "default"
	)

	Context("When creating a WorkspaceKind", Ordered, func() {

		testCases := []struct {
			// the "Should()" description of the test
			description string

			// the WorkspaceKind to attempt to create
			workspaceKind *kubefloworgv1beta1.WorkspaceKind

			// if the test should succeed
			shouldSucceed bool
		}{
			{
				description:   "should accept creation of a valid WorkspaceKind",
				workspaceKind: NewExampleWorkspaceKind("wsk-webhook-create--valid"),
				shouldSucceed: true,
			},
			{
				description:   "should reject creation with invalid podMetadata label key",
				workspaceKind: NewExampleWorkspaceKindWithInvalidPodMetadataLabelKey("wsk-webhook-create--invalid-pod-metadata--label-key"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid podMetadata annotation key",
				workspaceKind: NewExampleWorkspaceKindWithInvalidPodMetadataAnnotationKey("wsk-webhook-create--invalid-pod-metadata--annotation-key"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with cycle in imageConfig redirects",
				workspaceKind: NewExampleWorkspaceKindWithImageConfigCycle("wsk-webhook-create--image-config-cycle"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with cycle in podConfig redirects",
				workspaceKind: NewExampleWorkspaceKindWithPodConfigCycle("wsk-webhook-create--pod-config-cycle"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid redirect target in imageConfig options",
				workspaceKind: NewExampleWorkspaceKindWithInvalidImageConfigRedirect("wsk-webhook-create--image-config-invalid-redirect"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid redirect target in podConfig options",
				workspaceKind: NewExampleWorkspaceKindWithInvalidPodConfigRedirect("wsk-webhook-create--pod-config-invalid-redirect"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid default imageConfig",
				workspaceKind: NewExampleWorkspaceKindWithInvalidDefaultImageConfig("wsk-webhook-create--image-config-invalid-default"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid default podConfig",
				workspaceKind: NewExampleWorkspaceKindWithInvalidDefaultPodConfig("wsk-webhook-create--pod-config-invalid-default"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with duplicate ports in imageConfig",
				workspaceKind: NewExampleWorkspaceKindWithDuplicatePorts("wsk-webhook-create--image-config-duplicate-ports"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with empty ports array in podTemplate",
				workspaceKind: NewExampleWorkspaceKindWithEmptyPortsArrayInPodTemplate("wsk-webhook-create--pod-template-empty-ports-array"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with duplicate ports in podTemplate.ports",
				workspaceKind: NewExampleWorkspaceKindWithDuplicatePortsInPodTemplate("wsk-webhook-create--pod-template-duplicate-portids"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with non-existent portId in imageConfig.ports",
				workspaceKind: NewExampleWorkspaceKindWithNonExistentPortIdInImageConfig("wsk-webhook-create--image-config-non-existent-portid"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation if extraEnv[].value is not a valid Go template",
				workspaceKind: NewExampleWorkspaceKindWithInvalidExtraEnvValue("wsk-webhook-create--extra-invalid-env-value"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation if requestHeaders template is invalid",
				workspaceKind: NewExampleWorkspaceKindWithInvalidRequestHeadersValue("wsk-webhook-create--request-headers-invalid"),
				shouldSucceed: false,
			},
			{
				description:   "should accept creation with valid filterRules",
				workspaceKind: NewExampleWorkspaceKindWithValidFilterRules("wsk-webhook-create--filter-rules-valid"),
				shouldSucceed: true,
			},
			{
				description:   "should accept creation with matchNamespace on all filterRule scopes",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleNamespaceAllScopes("wsk-webhook-create--filter-rules-namespace-all-scopes"),
				shouldSucceed: true,
			},
			{
				description:   "should reject creation with a malformed filterRule label selector",
				workspaceKind: NewExampleWorkspaceKindWithInvalidFilterRuleSelector("wsk-webhook-create--filter-rules-invalid-selector"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with a filterRule scope outside the allowed enum",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleInvalidScope("wsk-webhook-create--filter-rules-invalid-scope"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with a filterRule that has an empty match list",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleEmptyMatch("wsk-webhook-create--filter-rules-empty-match-list"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with a filterRule match condition that sets no selector",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleNoMatchCondition("wsk-webhook-create--filter-rules-empty-match"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with a filterRule effect that sets neither ui nor api",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleEmptyEffect("wsk-webhook-create--filter-rules-empty-effect"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with a filterRule effect where all effect flags are false",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleAllEffectsFalse("wsk-webhook-create--filter-rules-all-effects-false"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with a filterRule denyMessage set without deny being true",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleDenyMessageWithoutDeny("wsk-webhook-create--filter-rules-deny-message-without-deny"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with matchPodConfig on a WORKSPACE_KIND scoped filterRule",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleScopeMismatch("wsk-webhook-create--filter-rules-scope-mismatch"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with matchImageConfig on a WORKSPACE_KIND scoped filterRule",
				workspaceKind: NewExampleWorkspaceKindWithFilterRuleImageConfigScopeMismatch("wsk-webhook-create--filter-rules-image-scope-mismatch"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with missing shebang in exec script",
				workspaceKind: NewExampleWorkspaceKindWithInvalidExecShebang("wsk-webhook-create--invalid-exec-shebang"),
				shouldSucceed: false,
			},
			{
				description:   "should accept creation with valid shebang (#!/bin/bash)",
				workspaceKind: NewExampleWorkspaceKindWithExecScript("wsk-webhook-create--valid-shebang-1", "#!/bin/bash\necho test"),
				shouldSucceed: true,
			},
			{
				description:   "should accept creation with valid shebang with spaces (#! /bin/sh)",
				workspaceKind: NewExampleWorkspaceKindWithExecScript("wsk-webhook-create--valid-shebang-2", "#! /bin/sh\necho test"),
				shouldSucceed: true,
			},
			{
				description:   "should accept creation with valid shebang and argument (#!/usr/bin/env python3)",
				workspaceKind: NewExampleWorkspaceKindWithExecScript("wsk-webhook-create--valid-shebang-3", "#!/usr/bin/env python3\nprint('test')"),
				shouldSucceed: true,
			},
			{
				description:   "should accept creation with valid shebang and multiple arguments (#!  /usr/bin/env   python3 -u)",
				workspaceKind: NewExampleWorkspaceKindWithExecScript("wsk-webhook-create--valid-shebang-4", "#!  /usr/bin/env   python3 -u\nprint('test')"),
				shouldSucceed: true,
			},
			{
				description:   "should reject creation with shebang missing interpreter (#!   )",
				workspaceKind: NewExampleWorkspaceKindWithExecScript("wsk-webhook-create--invalid-shebang-missing-interpreter", "#!   \necho test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with shebang exceeding length limit",
				workspaceKind: NewExampleWorkspaceKindWithExecScript("wsk-webhook-create--invalid-shebang-too-long", "#!/bin/bash "+strings.Repeat("a", 250)+"\necho test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid port reference in Jupyter probe",
				workspaceKind: NewExampleWorkspaceKindWithInvalidJupyterPort("wsk-webhook-create--invalid-jupyter-port"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with both exec and Jupyter probes specified",
				workspaceKind: NewExampleWorkspaceKindWithBothProbeTypes("wsk-webhook-create--both-probe-types"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation if minProbeIntervalSeconds > probeIntervalSeconds",
				workspaceKind: NewExampleWorkspaceKindWithInvalidProbeIntervals("wsk-webhook-create--invalid-probe-intervals"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation if jupyter.lastActivity is false",
				workspaceKind: NewExampleWorkspaceKindWithJupyterLastActivityFalse("wsk-webhook-create--jupyter-last-activity-false"),
				shouldSucceed: false,
			},
			{
				description: "should accept creation with valid activityRules and activityProbe",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--valid-rules", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
							MinRunningSeconds:  new(int32(300)),
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{
							MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
								Selector: metav1.LabelSelector{
									MatchLabels: map[string]string{"tier": "development"},
								},
							},
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 7200,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{}, // empty match = catch-all
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: true,
			},
			{
				description: "should accept creation when both MatchNamespace and MatchPodConfig are specified (AND semantics)",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-and-semantics", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{
							MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
								Selector: metav1.LabelSelector{
									MatchLabels: map[string]string{"tier": "development"},
								},
							},
							MatchPodConfig: &kubefloworgv1beta1.PodConfigMatch{
								Selector: metav1.LabelSelector{
									MatchLabels: map[string]string{"cpu": "100m"},
								},
							},
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: true,
			},
			{
				description: "should accept creation with pauseWorkspace: false rule overriding catch-all rule",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-override-false", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{
							MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
								Selector: metav1.LabelSelector{
									MatchLabels: map[string]string{"tier": "critical"},
								},
							},
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(false), // override to no-op culling
						},
					},
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 7200,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{}, // catch-all
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: true,
			},
			{
				description: "should reject creation if secondsSinceActive <= 15 seconds",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-low-seconds", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 15,
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: false,
			},
			{
				description: "should reject creation if minRunningSeconds is negative",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-neg-min-running", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
							MinRunningSeconds:  new(int32(-10)),
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: false,
			},
			{
				description: "should reject creation if multiple catch-all rules exist for pauseWorkspace effect",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-multiple-catchall", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 7200,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: false,
			},
			{
				description: "should reject creation if multiple catch-all rules exist with different pauseWorkspace values",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-multiple-catchall-diff", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(false),
						},
					},
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 7200,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: false,
			},
			{
				description: "should reject creation if catch-all rule is not the last rule",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-catchall-not-last", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3600,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 7200,
						},
						Match: &kubefloworgv1beta1.ActivityRuleMatch{
							MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
								Selector: metav1.LabelSelector{
									MatchLabels: map[string]string{"tier": "development"},
								},
							},
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				shouldSucceed: false,
			},
			{
				description: "should reject creation if activityRules with pauseWorkspace exist but activityProbe is not configured",
				workspaceKind: func() *kubefloworgv1beta1.WorkspaceKind {
					wsk := NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-no-probe", []kubefloworgv1beta1.ActivityRule{
						{
							Config: kubefloworgv1beta1.ActivityRuleConfig{
								SecondsSinceActive: 3600,
							},
							Effect: kubefloworgv1beta1.ActivityRuleEffect{
								PauseWorkspace: new(true),
							},
						},
					})
					wsk.Spec.PodTemplate.ActivityProbe = nil
					return wsk
				}(),
				shouldSucceed: false,
			},
			{
				description: "should accept creation with warning when secondsSinceActive is less than twice probeIntervalSeconds",
				workspaceKind: func() *kubefloworgv1beta1.WorkspaceKind {
					wsk := NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-warning-interval", []kubefloworgv1beta1.ActivityRule{
						{
							Config: kubefloworgv1beta1.ActivityRuleConfig{
								// 3000 is < 2 * 3600 (7200)
								SecondsSinceActive: 3000,
							},
							Effect: kubefloworgv1beta1.ActivityRuleEffect{
								PauseWorkspace: new(true),
							},
						},
					})
					return wsk
				}(),
				shouldSucceed: true,
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				if tc.shouldSucceed {
					By("creating the WorkspaceKind")
					Expect(k8sClient.Create(ctx, tc.workspaceKind)).To(Succeed())

					By("deleting the WorkspaceKind")
					Expect(k8sClient.Delete(ctx, tc.workspaceKind)).To(Succeed())
				} else {
					By("creating the WorkspaceKind")
					Expect(k8sClient.Create(ctx, tc.workspaceKind)).NotTo(Succeed())
				}
			})
		}

		warningTestCases := []struct {
			description     string
			workspaceKind   *kubefloworgv1beta1.WorkspaceKind
			expectedWarning string
		}{
			{
				description: "should return a warning when secondsSinceActive is less than twice probeIntervalSeconds and pauseWorkspace is true",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--warning-direct", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							// 3000 is < 2 * 3600 (7200)
							SecondsSinceActive: 3000,
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(true),
						},
					},
				}),
				expectedWarning: "is less than twice the probeIntervalSeconds",
			},
			{
				description: "should not return a warning when secondsSinceActive is less than twice probeIntervalSeconds and pauseWorkspace is false",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--no-warning-false", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3000,
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: new(false),
						},
					},
				}),
				expectedWarning: "",
			},
			{
				description: "should not return a warning when secondsSinceActive is less than twice probeIntervalSeconds and pauseWorkspace is nil",
				workspaceKind: NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--no-warning-nil", []kubefloworgv1beta1.ActivityRule{
					{
						Config: kubefloworgv1beta1.ActivityRuleConfig{
							SecondsSinceActive: 3000,
						},
						Effect: kubefloworgv1beta1.ActivityRuleEffect{
							PauseWorkspace: nil,
						},
					},
				}),
				expectedWarning: "",
			},
		}

		for _, tc := range warningTestCases {
			It(tc.description, func() {
				validator := &WorkspaceKindValidator{Client: k8sClient, Scheme: scheme.Scheme}
				warnings, err := validator.ValidateCreate(ctx, tc.workspaceKind)
				Expect(err).To(Succeed())
				if tc.expectedWarning != "" {
					Expect(warnings).To(HaveLen(1))
					Expect(warnings[0]).To(ContainSubstring(tc.expectedWarning))
				} else {
					Expect(warnings).To(BeEmpty())
				}
			})
		}

		// NOTE: This test must run directly via the Go webhook validator instead of the API server (testCases).
		// Currently, the CRD schema's CEL validation requires the 'pauseWorkspace' effect to be set. Trying to
		// create this resource in the API server will fail at the schema check phase. Directly invoking the
		// validator allows us to test the webhook's correct handling of nil effects (which supports future
		// independent evaluation of other effects) bypassing the temporary CEL restriction.
		It("should accept multiple catch-all rules with different effects", func() {
			wsk := NewExampleWorkspaceKindWithActivityRules("wsk-webhook-create--rules-multiple-catchall-diff-effects", []kubefloworgv1beta1.ActivityRule{
				{
					Config: kubefloworgv1beta1.ActivityRuleConfig{
						SecondsSinceActive: 7200,
					},
					Match: &kubefloworgv1beta1.ActivityRuleMatch{
						MatchNamespace: &kubefloworgv1beta1.NamespaceMatch{
							Selector: metav1.LabelSelector{
								MatchLabels: map[string]string{"tier": "development"},
							},
						},
					},
					Effect: kubefloworgv1beta1.ActivityRuleEffect{
						PauseWorkspace: new(true),
					},
				},
				{
					Config: kubefloworgv1beta1.ActivityRuleConfig{
						SecondsSinceActive: 10800,
					},
					Match: &kubefloworgv1beta1.ActivityRuleMatch{}, // catch-all
					Effect: kubefloworgv1beta1.ActivityRuleEffect{
						PauseWorkspace: new(true),
					},
				},
				{
					Config: kubefloworgv1beta1.ActivityRuleConfig{
						SecondsSinceActive: 7200,
					},
					Match: &kubefloworgv1beta1.ActivityRuleMatch{}, // catch-all
					Effect: kubefloworgv1beta1.ActivityRuleEffect{ // no-op, represent a future effect type
						PauseWorkspace: nil,
					},
				},
			})

			validator := &WorkspaceKindValidator{Client: k8sClient, Scheme: scheme.Scheme}
			warnings, err := validator.ValidateCreate(ctx, wsk)
			Expect(err).To(Succeed())
			Expect(warnings).To(BeEmpty())
		})
	})

	Context("When updating a WorkspaceKind", Ordered, func() {
		const (
			workspaceName     = "wsk-webhook-update-test"
			workspaceKindName = "wsk-webhook-update-test"
		)

		AfterEach(func() {
			By("deleting the Workspace, if it exists")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespaceName,
				},
			}
			_ = k8sClient.Delete(ctx, workspace)

			By("deleting the WorkspaceKind, if it exists")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			_ = k8sClient.Delete(ctx, workspaceKind)
		})

		testCases := []struct {
			// the "Should()" description of the test
			description string

			// if the test should succeed
			shouldSucceed bool

			// the initial state of the WorkspaceKind (required)
			workspaceKind *kubefloworgv1beta1.WorkspaceKind

			// the initial state of the Workspace, if any
			workspace *kubefloworgv1beta1.Workspace

			// modifyKindFn modifies the WorkspaceKind in some way.
			// returns a string matcher for the error message (only used if `shouldSucceed` is false)
			modifyKindFn func(*kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher
		}{
			{
				description:   "should accept re-ordering in-use imageConfig values",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					// reverse the imageConfig values list
					slices.Reverse(wsk.Spec.PodTemplate.Options.ImageConfig.Values)
					return ContainSubstring("")
				},
			},
			{
				description:   "should accept re-ordering in-use podConfig values",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					// reverse the podConfig values list
					slices.Reverse(wsk.Spec.PodTemplate.Options.PodConfig.Values)
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject updates to in-use imageConfig spec",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					inUseId := wsk.Spec.PodTemplate.Options.ImageConfig.Values[0].Id
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec.Image = "new-image:latest"
					return ContainSubstring("imageConfig value %q is in use and cannot be changed", inUseId)
				},
			},
			{
				description:   "should reject updates to in-use podConfig spec",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					inUseId := wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Id
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Spec.Resources = &corev1.ResourceRequirements{
						Limits: corev1.ResourceList{
							corev1.ResourceCPU: resource.MustParse("1.5"),
						},
					}
					return ContainSubstring("podConfig value %q is in use and cannot be changed", inUseId)
				},
			},
			{
				description:   "should accept updates to unused imageConfig spec",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Spec.Image = "new-image:latest"
					return ContainSubstring("")
				},
			},
			{
				description:   "should accept updates to unused podConfig spec",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.PodTemplate.Options.PodConfig.Values[1].Spec.Resources = &corev1.ResourceRequirements{
						Limits: corev1.ResourceList{
							corev1.ResourceCPU: resource.MustParse("1.5"),
						},
					}
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject removing in-use imageConfig values",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "jupyterlab_scipy_180"
					newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = newValues
					return ContainSubstring("imageConfig value %q is in use and cannot be removed", toBeRemoved)
				},
			},
			{
				description:   "should reject removing in-use podConfig values",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "tiny_cpu"
					newValues := make([]kubefloworgv1beta1.PodConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.PodConfig.Values = newValues
					return ContainSubstring("podConfig value %q is in use and cannot be removed", toBeRemoved)
				},
			},
			{
				description:   "should accept removing an unused imageConfig value",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "redirect_step_1"
					newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = newValues
					return ContainSubstring("")
				},
			},
			{
				description:   "should accept removing an unused podConfig value",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "redirect_step_1"
					newValues := make([]kubefloworgv1beta1.PodConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.PodConfig.Values = newValues
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject removing the default imageConfig value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "jupyterlab_scipy_190"
					newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = newValues
					return ContainSubstring("default imageConfig %q not found", toBeRemoved)
				},
			},
			{
				description:   "should reject removing the default podConfig value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				workspace:     NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "tiny_cpu"
					newValues := make([]kubefloworgv1beta1.PodConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.PodConfig.Values = newValues
					return ContainSubstring("default podConfig %q not found", toBeRemoved)
				},
			},
			{
				description:   "should reject removing the target of an imageConfig redirect",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "redirect_step_2"
					newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = newValues
					return ContainSubstring("target imageConfig %q does not exist", toBeRemoved)
				},
			},
			{
				description:   "should reject removing the target of a podConfig redirect",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := "redirect_step_2"
					newValues := make([]kubefloworgv1beta1.PodConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.PodConfig.Values = newValues
					return ContainSubstring("target podConfig %q does not exist", toBeRemoved)
				},
			},
			{
				description:   "should accept removing an entire imageConfig redirect chain",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := map[string]bool{"redirect_step_1": true, "redirect_step_2": true, "redirect_step_3": true}
					newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
						if !toBeRemoved[value.Id] {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = newValues
					return ContainSubstring("")
				},
			},
			{
				description:   "should accept removing an entire podConfig redirect chain",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					toBeRemoved := map[string]bool{"redirect_step_1": true, "redirect_step_2": true, "redirect_step_3": true}
					newValues := make([]kubefloworgv1beta1.PodConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
						if !toBeRemoved[value.Id] {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.PodConfig.Values = newValues
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject updating an imageConfig value to create a self-cycle",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					valueId := wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Id
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &kubefloworgv1beta1.OptionRedirect{To: valueId}
					return ContainSubstring("imageConfig redirect cycle detected: [%s]", valueId)
				},
			},
			{
				description:   "should reject updating a podConfig value to create a 2-step cycle",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					step1 := wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Id
					step2 := wsk.Spec.PodTemplate.Options.PodConfig.Values[1].Id
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &kubefloworgv1beta1.OptionRedirect{To: step2}
					wsk.Spec.PodTemplate.Options.PodConfig.Values[1].Redirect = &kubefloworgv1beta1.OptionRedirect{To: step1}
					return ContainSubstring("podConfig redirect cycle detected: [") // there is no guarantee on which element will be first
				},
			},
			{
				description:   "should reject updating an imageConfig to redirect to a non-existent value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidTarget := "invalid_image_config"
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &kubefloworgv1beta1.OptionRedirect{To: invalidTarget}
					return ContainSubstring("target imageConfig %q does not exist", invalidTarget)
				},
			},
			{
				description:   "should reject updating a podConfig to redirect to a non-existent value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidTarget := "invalid_pod_config"
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &kubefloworgv1beta1.OptionRedirect{To: invalidTarget}
					return ContainSubstring("target podConfig %q does not exist", invalidTarget)
				},
			},
			{
				description:   "should reject updating the default imageConfig value to a non-existent value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidDefault := "invalid_image_config"
					wsk.Spec.PodTemplate.Options.ImageConfig.Spawner.Default = invalidDefault
					return ContainSubstring("default imageConfig %q not found", invalidDefault)
				},
			},
			{
				description:   "should reject updating the default podConfig value to a non-existent value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidDefault := "invalid_pod_config"
					wsk.Spec.PodTemplate.Options.PodConfig.Spawner.Default = invalidDefault
					return ContainSubstring("default podConfig %q not found", invalidDefault)
				},
			},
			{
				description:   "should reject updating an imageConfig to have duplicate ports",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					duplicatePortNumber := int32(8888)
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Spec.Ports = []kubefloworgv1beta1.ImagePort{
						{
							Id:          "jupyterlab",
							DisplayName: new("JupyterLab"),
							Port:        duplicatePortNumber,
						},
						{
							Id:          "jupyterlab2",
							DisplayName: new("JupyterLab2"),
							Port:        duplicatePortNumber,
						},
					}
					return ContainSubstring("port %d is defined more than once", duplicatePortNumber)
				},
			},
			{
				description:   "should reject updating a portId in podTemplate.ports to a duplicate portId",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.PodTemplate.Ports[1].Id = "jupyterlab"
					return And(ContainSubstring("Duplicate value:"), ContainSubstring("jupyterlab"))
				},
			},
			{
				description:   "should reject updating a portId in podTemplate.ports to a non-existent portId in imageConfig.ports",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					existingPortId := wsk.Spec.PodTemplate.Ports[0].Id
					wsk.Spec.PodTemplate.Ports[0].Id = "non-existent-port-id"
					return ContainSubstring("%q: missing from spec.podTemplate.ports", existingPortId)
				},
			},
			{
				description:   "should reject updating a podMetadata.labels key to an invalid value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidKey := "!bad-key!"
					wsk.Spec.PodTemplate.PodMetadata.Labels = map[string]string{
						invalidKey: "some-value",
					}
					return ContainSubstring("Invalid value: %q", invalidKey)
				},
			},
			{
				description:   "should reject updating a podMetadata.annotations key to an invalid value",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidAnnotationKey := "!bad-key!"
					wsk.Spec.PodTemplate.PodMetadata.Annotations = map[string]string{
						invalidAnnotationKey: "some-value",
					}
					return ContainSubstring("Invalid value: %q", invalidAnnotationKey)
				},
			},
			{
				description:   "should reject updating an extraEnv[].value to an invalid Go template",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidValue := `{{ httpPathPrefix "jupyterlab" }`
					wsk.Spec.PodTemplate.ExtraEnv[0].Value = invalidValue
					return ContainSubstring("failed to parse template %q", invalidValue)
				},
			},
			{
				description:   "should accept updating an extraEnv[].value to a valid Go template",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.PodTemplate.ExtraEnv[0].Value = `{{ httpPathPrefix "jupyterlab"   }}`
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject updating requestHeaders template to an invalid Go template",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					invalidValue := `{{ httpPathPrefix "jupyterlab" }`
					wsk.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
						Set: map[string]string{
							"X-RStudio-Root-Path": invalidValue,
						},
					}
					return ContainSubstring("failed to parse template %q", invalidValue)
				},
			},
			{
				description:   "should accept updating requestHeaders template to a valid Go template",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
						Set: map[string]string{
							"X-RStudio-Root-Path": `{{ httpPathPrefix "jupyterlab" }}`,
						},
					}
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject updating to activityRules with invalid config",
				shouldSucceed: false,
				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.ActivityRules = []kubefloworgv1beta1.ActivityRule{
						{
							Config: kubefloworgv1beta1.ActivityRuleConfig{
								SecondsSinceActive: 5, // invalid
							},
							Effect: kubefloworgv1beta1.ActivityRuleEffect{
								PauseWorkspace: new(true),
							},
						},
					}
					return ContainSubstring("greater than or equal to 16")
				},
			},
			{
				description:   "should accept updating activityRules and activityProbe",
				shouldSucceed: true,
				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.ActivityRules = []kubefloworgv1beta1.ActivityRule{
						{
							Config: kubefloworgv1beta1.ActivityRuleConfig{
								SecondsSinceActive: 3600,
							},
							Effect: kubefloworgv1beta1.ActivityRuleEffect{
								PauseWorkspace: new(true),
							},
						},
					}
					return ContainSubstring("")
				},
			},
			{
				description:   "should accept adding valid filterRules",
				shouldSucceed: true,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.FilterRules = NewExampleWorkspaceKindWithValidFilterRules(workspaceKindName).Spec.FilterRules
					return ContainSubstring("")
				},
			},
			{
				description:   "should reject adding a filterRule with a malformed label selector",
				shouldSucceed: false,

				workspaceKind: NewExampleWorkspaceKind(workspaceKindName),
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) gomegaTypes.GomegaMatcher {
					wsk.Spec.FilterRules = NewExampleWorkspaceKindWithInvalidFilterRuleSelector(workspaceKindName).Spec.FilterRules
					return ContainSubstring("must be specified when `operator` is 'In' or 'NotIn'")
				},
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				if tc.workspaceKind == nil {
					Fail("invalid test case definition: workspaceKind is required")
				}

				By("creating the WorkspaceKind")
				// NOTE: cleanup is handled in the AfterEach()
				Expect(k8sClient.Create(ctx, tc.workspaceKind)).To(Succeed())

				By("retrieving the WorkspaceKind")
				workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
				Expect(k8sClient.Get(ctx, client.ObjectKeyFromObject(tc.workspaceKind), workspaceKind)).To(Succeed())

				if tc.workspace != nil {
					By("creating the Workspace")
					// NOTE: cleanup is handled in the AfterEach()
					// NOTE: we use Eventually because the webhook's cached client may not have seen
					//       the newly created WorkspaceKind yet, causing a transient "not found" error.
					Eventually(func() error {
						return k8sClient.Create(ctx, tc.workspace)
					}).Should(Succeed())

					By("retrieving the Workspace")
					workspace := &kubefloworgv1beta1.Workspace{}
					Expect(k8sClient.Get(ctx, client.ObjectKeyFromObject(tc.workspace), workspace)).To(Succeed())
				}

				By("updating the WorkspaceKind")
				patch := client.MergeFrom(workspaceKind.DeepCopy())
				modifiedWorkspaceKind := workspaceKind.DeepCopy()
				errMatcher := tc.modifyKindFn(modifiedWorkspaceKind)
				err := k8sClient.Patch(ctx, modifiedWorkspaceKind, patch)
				if tc.shouldSucceed {
					Expect(err).To(Succeed())
				} else {
					Expect(err).NotTo(Succeed())
					Expect(err.Error()).To(errMatcher)
				}
			})
		}
	})
})
