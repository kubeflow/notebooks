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
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/utils/ptr"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("WorkspaceKind Controller", func() {
	Context("When reconciling a resource", func() {
		const resourceName = "test-resource"

		ctx := context.Background()

		typeNamespacedName := types.NamespacedName{
			Name:      resourceName,
			Namespace: "default", // TODO(user):Modify as needed
		}
		workspacekind := &kubefloworgv1beta1.WorkspaceKind{}

		BeforeEach(func() {
			By("creating the custom resource for the Kind WorkspaceKind")
			err := k8sClient.Get(ctx, typeNamespacedName, workspacekind)
			if err != nil && errors.IsNotFound(err) {
				resource := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: resourceName,
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.Spawner{
							DisplayName:        "JupyterLab Notebook",
							Description:        "A Workspace which runs JupyterLab in a Pod",
							Hidden:             false,
							Deprecated:         false,
							DeprecationMessage: "This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind.",
							Icon: kubefloworgv1beta1.WorkspaceKindIcon{
								Url: ptr.To("https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png"),
							},
							Logo: kubefloworgv1beta1.WorkspaceKindIcon{
								ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
									Name: "my-logos",
									Key:  "apple-touch-icon-152x152.png",
								},
							},
						},

						PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
							PodMetadata: kubefloworgv1beta1.WorkspaceKindPodMetadata{},
							ServiceAccount: kubefloworgv1beta1.ServiceAccount{
								Name: "default-editor",
							},
							Culling: kubefloworgv1beta1.WorkspaceKindCullingConfig{
								Enabled:            true,
								MaxInactiveSeconds: 86400,
								ActivityProbe: kubefloworgv1beta1.WorkspaceKindActivityProbe{
									Exec: &kubefloworgv1beta1.WorkspaceKindActivityProbeExec{
										Command: []string{"bash", "-c", "exit 0"},
									},
								},
							},
							Probes: kubefloworgv1beta1.Probes{},
							VolumeMounts: kubefloworgv1beta1.VolumeMounts{
								Home: "/home/jovyan",
							},
							HTTPProxy: kubefloworgv1beta1.HTTPProxy{
								RemovePathPrefix: false,
								RequestHeaders: []kubefloworgv1beta1.RequestHeader{
									{
										Set:    map[string]string{"X-RStudio-Root-Path": "{{ .PathPrefix }}"},
										Append: map[string]string{},
										Remove: []string{},
									},
								},
							},
							ExtraEnv: []v1.EnvVar{
								{
									Name:  "NB_PREFIX",
									Value: "{{ .PathPrefix }}",
								},
							},
							Options: kubefloworgv1beta1.KindOptions{
								ImageConfig: kubefloworgv1beta1.ImageConfig{
									Default: "jupyter_scipy_171",
									Values: []kubefloworgv1beta1.ImageConfigValue{
										{
											Id: "jupyter_scipy_170",
											Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
												DisplayName: "jupyter-scipy:v1.7.0",
												Description: "JupyterLab 1.7.0, with SciPy Packages",
												Hidden:      true,
											},
											Redirect: kubefloworgv1beta1.OptionRedirect{
												To:             "jupyter_scipy_171",
												WaitForRestart: true,
											},
											Spec: kubefloworgv1beta1.ImageConfigSpec{
												Image: "docker.io/kubeflownotebookswg/jupyter-scipy:v1.7.0",
												Ports: []kubefloworgv1beta1.ImagePort{
													{
														DisplayName: "JupyterLab",
														Port:        8888,
														Protocol:    "HTTP",
													},
												},
											},
										},
									},
								},
								PodConfig: kubefloworgv1beta1.PodConfig{
									Default: "small_cpu",
									Values: []kubefloworgv1beta1.PodConfigValue{
										{
											Id: "small_cpu",
											Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
												DisplayName: "Small CPU",
												Description: "Pod with 1 CPU, 2 GB RAM, and 1 GPU",
												Hidden:      false,
											},
											Redirect: kubefloworgv1beta1.OptionRedirect{},
											Spec: kubefloworgv1beta1.PodConfigSpec{
												Resources: v1.ResourceRequirements{
													Requests: map[v1.ResourceName]resource.Quantity{
														"cpu":    resource.MustParse("1"),
														"memory": resource.MustParse("2Gi"),
													},
												},
											},
										},
									},
								},
							},
						},
					},
				}
				Expect(k8sClient.Create(ctx, resource)).To(Succeed())
			}
		})

		AfterEach(func() {
			// TODO(user): Cleanup logic after each test, like removing the resource instance.
			resource := &kubefloworgv1beta1.WorkspaceKind{}
			err := k8sClient.Get(ctx, typeNamespacedName, resource)
			Expect(err).NotTo(HaveOccurred())

			By("Cleanup the specific resource instance WorkspaceKind")
			Expect(k8sClient.Delete(ctx, resource)).To(Succeed())
		})
		It("should successfully reconcile the resource", func() {
			By("Reconciling the created resource")
			controllerReconciler := &WorkspaceKindReconciler{
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
