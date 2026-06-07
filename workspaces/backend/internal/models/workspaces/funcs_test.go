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

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

func TestWorkspacesModels(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Workspaces Models Suite")
}

var _ = Describe("defaultWorkspaceState", func() {
	It("returns WorkspaceStateUnknown for the empty string", func() {
		Expect(defaultWorkspaceState("")).To(Equal(kubefloworgv1beta1.WorkspaceStateUnknown))
	})

	It("returns the original state when it is already set", func() {
		for _, state := range []kubefloworgv1beta1.WorkspaceState{
			kubefloworgv1beta1.WorkspaceStateRunning,
			kubefloworgv1beta1.WorkspaceStateTerminating,
			kubefloworgv1beta1.WorkspaceStatePaused,
			kubefloworgv1beta1.WorkspaceStatePending,
			kubefloworgv1beta1.WorkspaceStateError,
			kubefloworgv1beta1.WorkspaceStateUnknown,
		} {
			Expect(defaultWorkspaceState(state)).To(Equal(state))
		}
	})
})
