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
