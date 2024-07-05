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
	"context"
	"k8s.io/utils/ptr"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("Workspace Controller", func() {

	// Define variables to store common objects for tests.
	var (
		testResource1 *kubefloworgv1beta1.Workspace
	)

	// Define utility constants and variables for object names and testing.
	const (
		testResourceName1     = "workspace-test"
		testResourceNamespace = "default"
	)

	BeforeEach(func() {
		testResource1 = &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:      testResourceName1,
				Namespace: "default",
			},
			Spec: kubefloworgv1beta1.WorkspaceSpec{
				Paused: ptr.To(false),
				Kind:   "juptyerlab",
				PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
					PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
						Labels:      nil,
						Annotations: nil,
					},
					Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
						Home: "my-home-pvc",
						Data: []kubefloworgv1beta1.PodVolumeMount{
							{
								Name:      "my-data-pvc",
								MountPath: "/data/my-data",
							},
						},
					},
					Options: kubefloworgv1beta1.WorkspacePodOptions{
						ImageConfig: "jupyter_scipy_170",
						PodConfig:   "big_gpu",
					},
				},
			},
		}
	})

	Context("When reconciling a Workspace", func() {
		ctx := context.Background()

		typeNamespacedName := types.NamespacedName{
			Name:      testResourceName1,
			Namespace: testResourceNamespace,
		}

		workspace := &kubefloworgv1beta1.Workspace{}

		BeforeEach(func() {
			By("creating the custom resource for the Kind Workspace")
			err := k8sClient.Get(ctx, typeNamespacedName, workspace)
			if err != nil && errors.IsNotFound(err) {
				resource := testResource1.DeepCopy()
				Expect(k8sClient.Create(ctx, resource)).To(Succeed())
			} else {
				Expect(err).NotTo(HaveOccurred())
			}

			By("checking if the Workspace exists")
			Expect(k8sClient.Get(ctx, typeNamespacedName, workspace)).To(Succeed())
		})

		AfterEach(func() {
			By("checking if the Workspace still exists")
			resource := &kubefloworgv1beta1.Workspace{}
			err := k8sClient.Get(ctx, typeNamespacedName, resource)
			Expect(err).NotTo(HaveOccurred())

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, resource)).To(Succeed())
		})

		It("should not allow updating immutable fields", func() {
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update the `spec.kind` field")
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.Kind = "new-kind"
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).NotTo(Succeed())
		})

		It("should successfully reconcile the resource", func() {
			By("Reconciling the created resource")
			controllerReconciler := &WorkspaceReconciler{
				Client: k8sClient,
				Scheme: k8sClient.Scheme(),
			}

			_, err := controllerReconciler.Reconcile(ctx, reconcile.Request{
				NamespacedName: typeNamespacedName,
			})
			Expect(err).NotTo(HaveOccurred())
			// TODO(user): Add more specific assertions depending on your controller's reconciliation logic.
			// Example: If you expect a certain status condition after reconciliation, verify it here.
		})
	})
})
