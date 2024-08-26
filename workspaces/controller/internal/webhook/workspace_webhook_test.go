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
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("Workspace Webhook", func() {

	Context("When creating Workspace under Validating Webhook", Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			namespaceName     string
		)

		BeforeAll(func() {
			uniqueName := "ws-create-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			namespaceName = "default"
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should reject workspace creation with an invalid WorkspaceKind", func() {
			invalidWorkspaceKindName := "invalid-workspace-kind"

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, invalidWorkspaceKindName)
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("workspace kind %q not found", invalidWorkspaceKindName)))
		})

		It("should successfully create workspace with a valid WorkspaceKind", func() {
			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
		})
	})

})
