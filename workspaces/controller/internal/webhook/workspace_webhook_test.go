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

	"k8s.io/apimachinery/pkg/types"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("Workspace Webhook", func() {

	const (
		namespaceName = "default"
	)

	Context("When creating a Workspace", Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "ws-webhook-create-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
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

		It("should reject an invalid workspace kind", func() {
			invalidWorkspaceKindName := "invalid-workspace-kind"

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, invalidWorkspaceKindName)
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("workspace kind %q not found", invalidWorkspaceKindName)))
		})

		It("should reject an invalid imageConfig", func() {
			invalidImageConfig := "invalid_image_config"

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.Options.ImageConfig = invalidImageConfig
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("imageConfig with id %q not found in workspace kind %q", invalidImageConfig, workspaceKindName)))
		})

		It("should reject an invalid podConfig", func() {
			invalidPodConfig := "invalid_pod_config"

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.Options.PodConfig = invalidPodConfig
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("podConfig with id %q not found in workspace kind %q", invalidPodConfig, workspaceKindName)))
		})

		It("should accept a valid workspace", func() {
			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
		})
	})

	Context("When updating a Workspace", Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-webhook-update-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())

			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
		})

		It("should not allow updating immutable fields", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update the `spec.kind` field")
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.Kind = "new_kind"
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).NotTo(Succeed())
		})

		It("should handle imageConfig updates", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update the `spec.podTemplate.options.imageConfig` field to an invalid value")
			invalidPodConfig := "invalid_image_config"
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.Options.ImageConfig = invalidPodConfig
			err := k8sClient.Patch(ctx, newWorkspace, patch)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("imageConfig with id %q not found in workspace kind %q", invalidPodConfig, workspace.Spec.Kind)))

			By("updating the `spec.podTemplate.options.imageConfig` field to a valid value")
			validImageConfig := "jupyterlab_scipy_190"
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.Options.ImageConfig = validImageConfig
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())
		})

		It("should handle podConfig updates", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update the `spec.podTemplate.options.podConfig` field to an invalid value")
			invalidPodConfig := "invalid_pod_config"
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.Options.PodConfig = invalidPodConfig
			err := k8sClient.Patch(ctx, newWorkspace, patch)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("podConfig with id %q not found in workspace kind %q", invalidPodConfig, workspace.Spec.Kind)))

			By("updating the `spec.podTemplate.options.podConfig` field to a valid value")
			validPodConfig := "small_cpu"
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.Options.PodConfig = validPodConfig
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())
		})
	})
})
