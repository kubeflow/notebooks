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
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

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

		It("should reject an invalid podMetadata.labels key", func() {
			invalidLabelKey := "!bad-key!"

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{}
			workspace.Spec.PodTemplate.PodMetadata.Labels = map[string]string{
				invalidLabelKey: "value",
			}
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("Invalid value: %q", invalidLabelKey)))
		})

		It("should reject an invalid podMetadata.annotations key", func() {
			invalidAnnotationKey := "!bad-key!"

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{}
			workspace.Spec.PodTemplate.PodMetadata.Annotations = map[string]string{
				invalidAnnotationKey: "value",
			}
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("Invalid value: %q", invalidAnnotationKey)))
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

		It("should accept a valid workspace without displayName", func() {
			By("creating the Workspace")
			workspace := NewExampleWorkspaceWithoutDisplayName(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("verifying displayName is nil")
			created := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, created)).To(Succeed())
			Expect(created.Spec.DisplayName).To(BeNil())

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

			Eventually(func() error {
				return k8sClient.Get(ctx, types.NamespacedName{Name: workspaceKindName}, &kubefloworgv1beta1.WorkspaceKind{})
			}, time.Second*5, time.Millisecond*100).Should(Succeed())

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

		It("should handle podMetadata.labels updates", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update `spec.podTemplate.podMetadata.labels` with an invalid key")
			invalidLabelKey := "!bad-key!"
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{}
			newWorkspace.Spec.PodTemplate.PodMetadata.Labels = map[string]string{
				invalidLabelKey: "value",
			}
			err := k8sClient.Patch(ctx, newWorkspace, patch)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("Invalid value: %q", invalidLabelKey)))

			By("updating `spec.podTemplate.podMetadata.labels` with a valid key")
			validLabelKey := "good-key"
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{}
			newWorkspace.Spec.PodTemplate.PodMetadata.Labels = map[string]string{
				validLabelKey: "value",
			}
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())
		})

		It("should handle podMetadata.annotations updates", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update `spec.podTemplate.podMetadata.annotations` with an invalid key")
			invalidAnnotationKey := "!bad-key!"
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{}
			newWorkspace.Spec.PodTemplate.PodMetadata.Annotations = map[string]string{
				invalidAnnotationKey: "value",
			}
			err := k8sClient.Patch(ctx, newWorkspace, patch)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring(fmt.Sprintf("Invalid value: %q", invalidAnnotationKey)))

			By("updating `spec.podTemplate.podMetadata.annotations` with a valid key")
			validAnnotationKey := "good-key"
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{}
			newWorkspace.Spec.PodTemplate.PodMetadata.Annotations = map[string]string{
				validAnnotationKey: "value",
			}
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())
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

	Context("When orphan-deleting a Workspace", Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-webhook-orphan-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			Eventually(func() error {
				return k8sClient.Get(ctx, types.NamespacedName{Name: workspaceKindName}, &kubefloworgv1beta1.WorkspaceKind{})
			}, time.Second*5, time.Millisecond*100).Should(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should reject creating a Workspace with the `orphan` finalizer", func() {
			By("creating the Workspace")
			workspace := NewExampleWorkspace(fmt.Sprintf("%s-create", workspaceName), namespaceName, workspaceKindName)
			workspace.Finalizers = []string{metav1.FinalizerOrphanDependents}
			err := k8sClient.Create(ctx, workspace)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring("orphan deletion is not permitted for Workspaces"))
		})

		It("should reject an update which adds the `orphan` finalizer", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to add the `orphan` finalizer")
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Finalizers = append(newWorkspace.Finalizers, metav1.FinalizerOrphanDependents)
			err := k8sClient.Patch(ctx, newWorkspace, patch)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring("orphan deletion is not permitted for Workspaces"))
		})

		It("should allow an update which adds a non-`orphan` finalizer", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("adding the finalizer")
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Finalizers = append(newWorkspace.Finalizers, "notebooks.kubeflow.org/test-finalizer")
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())

			By("removing the finalizer")
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch = client.MergeFrom(workspace.DeepCopy())
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Finalizers = nil
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())
		})

		It("should reject a delete with `propagationPolicy=Orphan`", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())

			By("failing to delete the Workspace")
			err := k8sClient.Delete(ctx, workspace, client.PropagationPolicy(metav1.DeletePropagationOrphan))
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring("orphan deletion is not permitted for Workspaces"))

			By("verifying the Workspace was not deleted")
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			Expect(workspace.DeletionTimestamp).To(BeNil())
		})

		It("should reject a delete with the deprecated `orphanDependents=true`", func() {
			By("creating the dynamic client")
			// NOTE: the typed client has no option for the deprecated `orphanDependents` field
			dynamicClient, err := dynamic.NewForConfig(cfg)
			Expect(err).NotTo(HaveOccurred())
			workspaceGVR := schema.GroupVersionResource{
				Group:    kubefloworgv1beta1.GroupVersion.Group,
				Version:  kubefloworgv1beta1.GroupVersion.Version,
				Resource: "workspaces",
			}

			By("failing to delete the Workspace")
			err = dynamicClient.Resource(workspaceGVR).Namespace(namespaceName).Delete(ctx, workspaceName, metav1.DeleteOptions{
				OrphanDependents: new(true),
			})
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring("orphan deletion is not permitted for Workspaces"))

			By("verifying the Workspace was not deleted")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			Expect(workspace.DeletionTimestamp).To(BeNil())
		})

		It("should allow a delete with `propagationPolicy=Background`", func() {
			By("creating the Workspace")
			cascadeName := fmt.Sprintf("%s-cascade", workspaceName)
			workspace := NewExampleWorkspace(cascadeName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspace, client.PropagationPolicy(metav1.DeletePropagationBackground))).To(Succeed())
		})

		It("should allow a delete with no propagationPolicy", func() {
			By("creating the Workspace")
			defaultName := fmt.Sprintf("%s-default", workspaceName)
			workspace := NewExampleWorkspace(defaultName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
		})
	})
})
