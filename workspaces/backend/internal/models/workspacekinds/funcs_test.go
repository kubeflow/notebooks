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
)

func TestWorkspaceKinds(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "WorkspaceKinds Models Suite")
}

var _ = Describe("NewWorkspaceKindModelFromWorkspaceKind", func() {

	It("should include a stubbed ruleEffects with uiHide set to false", func() {
		By("building the model from a minimal WorkspaceKind")
		wsk := &kubefloworgv1beta1.WorkspaceKind{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-wsk",
			},
		}
		model := NewWorkspaceKindModelFromWorkspaceKind((*config.EnvConfig)(nil), wsk)

		By("ensuring the compatibility selectors stub is present and hard-coded to false")
		// TODO: update this expectation once WorkspaceKind filterRules evaluation is
		//       implemented (https://github.com/kubeflow/notebooks/issues/682).
		Expect(model.RuleEffects).To(Equal(RuleEffects{UiHide: false}))
	})
})
