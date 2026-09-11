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
	"slices"
	"time"

	"k8s.io/apimachinery/pkg/types"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	rbacv1 "k8s.io/api/rbac/v1"
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
})

var _ = Describe("Workspace ServiceAccount Roles Webhook", Ordered, func() {

	const namespaceName = "default"

	// the rules a caller needs just to manage Workspaces, with no RBAC permissions of their own
	workspaceOnlyRules := []rbacv1.PolicyRule{
		{
			APIGroups: []string{kubefloworgv1beta1.GroupVersion.Group},
			Resources: []string{"workspaces"},
			Verbs:     []string{"create", "get", "list", "patch", "update", "delete"},
		},
	}
	roleBindingRule := rbacv1.PolicyRule{
		APIGroups: []string{rbacv1.GroupName},
		Resources: []string{"rolebindings"},
		Verbs:     []string{"create", "delete"},
	}

	var (
		workspaceKindName string

		// unprivilegedClient can manage Workspaces but cannot touch RoleBindings
		unprivilegedClient client.Client

		// binderClient can manage Workspaces and create/delete RoleBindings
		binderClient client.Client
	)

	// newWorkspaceWithRoles returns an example Workspace with the given Roles bound to its ServiceAccount.
	newWorkspaceWithRoles := func(name string, roleNames ...string) *kubefloworgv1beta1.Workspace {
		workspace := NewExampleWorkspace(name, namespaceName, workspaceKindName)
		roles := make([]kubefloworgv1beta1.WorkspaceRole, len(roleNames))
		for i, roleName := range roleNames {
			roles[i] = kubefloworgv1beta1.WorkspaceRole{Name: roleName}
		}
		workspace.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceServiceAccount{Roles: roles}
		return workspace
	}

	BeforeAll(func() {
		workspaceKindName = "workspacekind-ws-webhook-roles-test"

		By("creating the WorkspaceKind")
		Expect(k8sClient.Create(ctx, NewExampleWorkspaceKind(workspaceKindName))).To(Succeed())

		By("creating the test users")
		unprivilegedClient = NewUserClient("ws-roles-unprivileged", namespaceName, workspaceOnlyRules)
		binderClient = NewUserClient("ws-roles-binder", namespaceName, append(slices.Clone(workspaceOnlyRules), roleBindingRule))
	})

	AfterAll(func() {
		By("deleting the WorkspaceKind")
		workspaceKind := &kubefloworgv1beta1.WorkspaceKind{ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName}}
		Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
	})

	It("should allow a Workspace with no Roles from a caller who cannot create RoleBindings", func() {
		workspace := NewExampleWorkspace("workspace-roles-none", namespaceName, workspaceKindName)
		Expect(unprivilegedClient.Create(ctx, workspace)).To(Succeed())
		Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
	})

	It("should reject creating a Workspace with Roles from a caller who cannot create RoleBindings", func() {
		workspace := newWorkspaceWithRoles("workspace-roles-create-denied", "trainjob-mpi-exec")
		err := unprivilegedClient.Create(ctx, workspace)
		Expect(err).NotTo(Succeed())
		Expect(err.Error()).To(ContainSubstring("requires permission to create RoleBindings"))
		Expect(err.Error()).To(ContainSubstring("trainjob-mpi-exec"))
	})

	It("should allow creating a Workspace with Roles from a caller who can create RoleBindings", func() {
		workspace := newWorkspaceWithRoles("workspace-roles-create-allowed", "trainjob-mpi-exec")
		Expect(binderClient.Create(ctx, workspace)).To(Succeed())
		Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
	})

	Context("when updating an existing Workspace which already has a Role", Ordered, func() {
		var (
			workspaceName = "workspace-roles-update"
			workspaceKey  types.NamespacedName
		)

		BeforeAll(func() {
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}
			Expect(binderClient.Create(ctx, newWorkspaceWithRoles(workspaceName, "trainjob-mpi-exec"))).To(Succeed())
		})

		AfterAll(func() {
			workspace := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName}}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
		})

		// patchRoles replaces `spec.podTemplate.serviceAccount.roles` as the given caller.
		patchRoles := func(c client.Client, roleNames ...string) error {
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())
			roles := make([]kubefloworgv1beta1.WorkspaceRole, len(roleNames))
			for i, roleName := range roleNames {
				roles[i] = kubefloworgv1beta1.WorkspaceRole{Name: roleName}
			}
			workspace.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceServiceAccount{Roles: roles}
			return c.Patch(ctx, workspace, patch)
		}

		It("should allow an unrelated update which leaves the Roles unchanged", func() {
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())
			workspace.Spec.Paused = new(true)
			Expect(unprivilegedClient.Patch(ctx, workspace, patch)).To(Succeed())
		})

		It("should reject adding a Role from a caller who cannot create RoleBindings", func() {
			err := patchRoles(unprivilegedClient, "trainjob-mpi-exec", "another-role")
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring("requires permission to create RoleBindings"))
		})

		It("should reject removing a Role from a caller who cannot delete RoleBindings", func() {
			err := patchRoles(unprivilegedClient)
			Expect(err).NotTo(Succeed())
			Expect(err.Error()).To(ContainSubstring("requires permission to delete RoleBindings"))
		})

		It("should allow adding and removing Roles from a caller who can", func() {
			Expect(patchRoles(binderClient, "trainjob-mpi-exec", "another-role")).To(Succeed())
			Expect(patchRoles(binderClient, "another-role")).To(Succeed())
			Expect(patchRoles(binderClient)).To(Succeed())
		})
	})
})
