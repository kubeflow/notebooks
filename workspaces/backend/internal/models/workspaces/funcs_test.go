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

package workspaces

import (
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestWorkspaces(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Workspaces Models Suite")
}

var _ = Describe("buildLastProbeInfo", func() {
	It("returns nil when probe is nil", func() {
		Expect(buildLastProbeInfo(nil)).To(BeNil())
	})

	It("converts a WorkspaceActivityLastProbe correctly", func() {
		crdProbe := &kubefloworgv1beta1.WorkspaceActivityLastProbe{
			StartTime: 1710435303000,
			EndTime:   1710435305000,
			Result:    kubefloworgv1beta1.WorkspaceProbeResultSuccess,
			Message:   "Jupyter probe succeeded",
		}

		apiProbe := buildLastProbeInfo(crdProbe)
		Expect(apiProbe).NotTo(BeNil())
		Expect(apiProbe.StartTime).To(Equal(int64(1710435303000)))
		Expect(apiProbe.EndTime).To(Equal(int64(1710435305000)))
		Expect(apiProbe.Result).To(Equal(ProbeResultSuccess))
		Expect(apiProbe.Message).To(Equal("Jupyter probe succeeded"))
	})
})

var _ = Describe("buildActivityRules", func() {
	It("returns nil when activity or pause rule is nil", func() {
		Expect(buildActivityRules(nil)).To(BeNil())
		Expect(buildActivityRules(&kubefloworgv1beta1.WorkspaceActivity{})).To(BeNil())
		Expect(buildActivityRules(&kubefloworgv1beta1.WorkspaceActivity{
			Rules: &kubefloworgv1beta1.WorkspaceActivityRules{},
		})).To(BeNil())
	})

	It("returns converted ActivityRules with pauseWorkspace rule", func() {
		activity := &kubefloworgv1beta1.WorkspaceActivity{
			Rules: &kubefloworgv1beta1.WorkspaceActivityRules{
				PauseWorkspace: &kubefloworgv1beta1.WorkspaceActivityPauseRule{
					EligibleAfter: 1707667200000,
				},
			},
		}

		rules := buildActivityRules(activity)
		Expect(rules).NotTo(BeNil())
		Expect(rules.PauseWorkspace).NotTo(BeNil())
		Expect(rules.PauseWorkspace.EligibleAfter).To(Equal(int64(1707667200000)))
	})
})
