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

package controller

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var _ = Describe("WorkspaceKind Controller", func() {

	// Define utility constants for object names and testing timeouts/durations and intervals.
	const (
		namespaceName = "default"

		// how long to wait in "Eventually" blocks
		timeout = time.Second * 10

		// how long to wait in "Consistently" blocks
		duration = time.Second * 10 // nolint:unused

		// how frequently to poll for conditions
		interval = time.Millisecond * 250
	)

	Context("When updating a WorkspaceKind", Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "wsk-update-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
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

		It("should not allow updating immutable fields", func() {
			By("getting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())

			By("failing to update the `spec.podTemplate.serviceAccount.name` field")
			newWorkspaceKind := workspaceKind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.ServiceAccount.Name = "new-editor"
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("failing to update the `spec.podTemplate.volumeMounts.home` field")
			newWorkspaceKind = workspaceKind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.VolumeMounts.Home = "/home/jovyan/new"
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())
		})

		It("should not allow mutually exclusive fields to be set", func() {
			By("getting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())

			By("only allowing one of `spec.spawner.icon.{url,configMap}` to be set")
			newWorkspaceKind := workspaceKind.DeepCopy()
			newWorkspaceKind.Spec.Spawner.Icon = kubefloworgv1beta1.WorkspaceKindIcon{
				Url: ptr.To("https://example.com/icon.png"),
				ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
					Name:      "my-logos",
					Namespace: namespaceName,
					Key:       "icon.png",
				},
			}
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("only allowing one of `spec.podTemplate.culling.activityProbe.{exec,jupyter}` to be set")
			newWorkspaceKind = workspaceKind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.Culling.ActivityProbe = kubefloworgv1beta1.ActivityProbe{
				Exec: &kubefloworgv1beta1.ActivityProbeExec{
					Command: []string{"bash", "-c", "exit 0"},
				},
				Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{
					LastActivity: true,
				},
			}
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())
		})
	})

	Context("When reconciling a WorkspaceKind", Serial, Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "wsk-reconcile-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}
		})

		It("should update the WorkspaceKind status", func() {

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("reconciling the WorkspaceKind status")
			expectedStatus := &kubefloworgv1beta1.WorkspaceKindStatus{
				Workspaces: 1,
				PodTemplateOptions: kubefloworgv1beta1.PodTemplateOptionsMetrics{
					ImageConfig: []kubefloworgv1beta1.OptionMetric{
						{
							Id:         "jupyterlab_scipy_180",
							Workspaces: 1,
						},
						{
							Id:         "jupyterlab_scipy_190",
							Workspaces: 0,
						},
					},
					PodConfig: []kubefloworgv1beta1.OptionMetric{
						{
							Id:         "tiny_cpu",
							Workspaces: 1,
						},
						{
							Id:         "small_cpu",
							Workspaces: 0,
						},
						{
							Id:         "big_gpu",
							Workspaces: 0,
						},
					},
				},
			}
			Eventually(func() *kubefloworgv1beta1.WorkspaceKindStatus {
				if err := k8sClient.Get(ctx, workspaceKindKey, workspaceKind); err != nil {
					return nil
				}
				return &workspaceKind.Status
			}, timeout, interval).Should(Equal(expectedStatus))

			By("having a finalizer set on the WorkspaceKind")
			Expect(workspaceKind.GetFinalizers()).To(ContainElement(WorkspaceKindFinalizer))

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("reconciling the WorkspaceKind status")
			expectedStatus = &kubefloworgv1beta1.WorkspaceKindStatus{
				Workspaces: 0,
				PodTemplateOptions: kubefloworgv1beta1.PodTemplateOptionsMetrics{
					ImageConfig: []kubefloworgv1beta1.OptionMetric{
						{
							Id:         "jupyterlab_scipy_180",
							Workspaces: 0,
						},
						{
							Id:         "jupyterlab_scipy_190",
							Workspaces: 0,
						},
					},
					PodConfig: []kubefloworgv1beta1.OptionMetric{
						{
							Id:         "tiny_cpu",
							Workspaces: 0,
						},
						{
							Id:         "small_cpu",
							Workspaces: 0,
						},
						{
							Id:         "big_gpu",
							Workspaces: 0,
						},
					},
				},
			}
			Eventually(func() *kubefloworgv1beta1.WorkspaceKindStatus {
				if err := k8sClient.Get(ctx, workspaceKindKey, workspaceKind); err != nil {
					return nil
				}
				return &workspaceKind.Status
			}, timeout, interval).Should(Equal(expectedStatus))

			By("having no finalizer set on the WorkspaceKind")
			Expect(workspaceKind.GetFinalizers()).To(BeEmpty())

			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).NotTo(Succeed())
		})
	})
})
