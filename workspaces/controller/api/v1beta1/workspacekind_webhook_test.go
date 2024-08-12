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

package v1beta1

import (
	"fmt"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var _ = Describe("WorkspaceKind Webhook", func() {

	Context("When updating WorkspaceKind under Validating Webhook", Ordered, func() {
		var (
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "wsk-webhook-update-test"
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			workspaceKind := &WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should not allow updating immutable fields", func() {
			By("getting the WorkspaceKind")
			workspaceKind := &WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())

			By("failing to update the `spec.podTemplate.options.imageConfig.values[0].spec` field")
			newWorkspaceKind := workspaceKind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec.Image = "new-image:latest"
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("failing to update the `spec.podTemplate.options.podConfig.values[0].spec` field")
			newWorkspaceKind = workspaceKind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec.Resources.Requests[v1.ResourceCPU] = resource.MustParse("99")
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())
		})

	})

})
