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
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("WorkspaceKind Controller", func() {

	// Define variables to store common objects for tests.
	var (
		testResource1 *kubefloworgv1beta1.WorkspaceKind
	)

	// Define utility constants and variables for object names and testing.
	const (
		testResourceName1 = "jupyterlab"
	)

	BeforeEach(func() {
		testResource1 = &kubefloworgv1beta1.WorkspaceKind{
			ObjectMeta: metav1.ObjectMeta{
				Name: testResourceName1,
			},
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
					DisplayName:        "JupyterLab Notebook",
					Description:        "A Workspace which runs JupyterLab in a Pod",
					Hidden:             ptr.To(false),
					Deprecated:         ptr.To(false),
					DeprecationMessage: ptr.To("This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind."),
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
					PodMetadata: &kubefloworgv1beta1.WorkspaceKindPodMetadata{},
					ServiceAccount: kubefloworgv1beta1.WorkspaceKindServiceAccount{
						Name: "default-editor",
					},
					Culling: &kubefloworgv1beta1.WorkspaceKindCullingConfig{
						Enabled:            ptr.To(true),
						MaxInactiveSeconds: ptr.To(int64(86400)),
						ActivityProbe: kubefloworgv1beta1.ActivityProbe{
							Exec: &kubefloworgv1beta1.ActivityProbeExec{
								Command: []string{"bash", "-c", "exit 0"},
							},
						},
					},
					Probes: &kubefloworgv1beta1.WorkspaceKindProbes{},
					VolumeMounts: kubefloworgv1beta1.WorkspaceKindVolumeMounts{
						Home: "/home/jovyan",
					},
					HTTPProxy: &kubefloworgv1beta1.HTTPProxy{
						RemovePathPrefix: ptr.To(false),
						RequestHeaders: &kubefloworgv1beta1.IstioHeaderOperations{
							Set:    map[string]string{"X-RStudio-Root-Path": "{{ .PathPrefix }}"},
							Add:    map[string]string{},
							Remove: []string{},
						},
					},
					ExtraEnv: []v1.EnvVar{
						{
							Name:  "NB_PREFIX",
							Value: "{{ .PathPrefix }}",
						},
					},
					ContainerSecurityContext: &v1.SecurityContext{
						AllowPrivilegeEscalation: ptr.To(false),
						Capabilities: &v1.Capabilities{
							Drop: []v1.Capability{"ALL"},
						},
						RunAsNonRoot: ptr.To(true),
					},
					Options: kubefloworgv1beta1.WorkspaceKindPodOptions{
						ImageConfig: kubefloworgv1beta1.ImageConfig{
							Default: "jupyter_scipy_171",
							Values: []kubefloworgv1beta1.ImageConfigValue{
								{
									Id: "jupyter_scipy_170",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										DisplayName: "jupyter-scipy:v1.7.0",
										Description: ptr.To("JupyterLab 1.7.0, with SciPy Packages"),
										Hidden:      ptr.To(true),
									},
									Redirect: &kubefloworgv1beta1.OptionRedirect{
										To:             "jupyter_scipy_171",
										WaitForRestart: true,
										Message: &kubefloworgv1beta1.RedirectMessage{
											Level: "Info",
											Text:  "This update will increase the version of JupyterLab to v1.7.1",
										},
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
										Description: ptr.To("Pod with 1 CPU, 2 GB RAM, and 1 GPU"),
										Hidden:      ptr.To(false),
									},
									Redirect: nil,
									Spec: kubefloworgv1beta1.PodConfigSpec{
										Resources: &v1.ResourceRequirements{
											Requests: map[v1.ResourceName]resource.Quantity{
												v1.ResourceCPU:    resource.MustParse("1"),
												v1.ResourceMemory: resource.MustParse("2Gi"),
											},
										},
									},
								},
								{
									Id: "big_gpu",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										DisplayName: "Big GPU",
										Description: ptr.To("Pod with 4 CPUs, 16 GB RAM, and 1 GPU"),
										Hidden:      ptr.To(false),
									},
									Redirect: nil,
									Spec: kubefloworgv1beta1.PodConfigSpec{
										Affinity:     nil,
										NodeSelector: nil,
										Tolerations: []v1.Toleration{
											{
												Key:      "nvidia.com/gpu",
												Operator: v1.TolerationOpExists,
												Effect:   v1.TaintEffectNoSchedule,
											},
										},
										Resources: &v1.ResourceRequirements{
											Requests: map[v1.ResourceName]resource.Quantity{
												v1.ResourceCPU:    resource.MustParse("4"),
												v1.ResourceMemory: resource.MustParse("16Gi"),
											},
											Limits: map[v1.ResourceName]resource.Quantity{
												"nvidia.com/gpu": resource.MustParse("1"),
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
	})

	Context("When reconciling a WorkspaceKind", func() {
		ctx := context.Background()

		typeNamespacedName := types.NamespacedName{
			Name: testResourceName1,
		}

		workspacekind := &kubefloworgv1beta1.WorkspaceKind{}

		BeforeEach(func() {
			By("creating a new WorkspaceKind")
			err := k8sClient.Get(ctx, typeNamespacedName, workspacekind)
			if err != nil && errors.IsNotFound(err) {
				resource := testResource1.DeepCopy()
				Expect(k8sClient.Create(ctx, resource)).To(Succeed())
			} else {
				Expect(err).NotTo(HaveOccurred())
			}

			By("checking if the WorkspaceKind exists")
			Expect(k8sClient.Get(ctx, typeNamespacedName, workspacekind)).To(Succeed())
		})

		AfterEach(func() {
			By("checking if the WorkspaceKind still exists")
			resource := &kubefloworgv1beta1.WorkspaceKind{}
			err := k8sClient.Get(ctx, typeNamespacedName, resource)
			Expect(err).NotTo(HaveOccurred())

			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, resource)).To(Succeed())
		})

		It("should not allow updating immutable fields", func() {
			patch := client.MergeFrom(workspacekind.DeepCopy())

			By("failing to update the `spec.podTemplate.serviceAccount.name` field")
			newWorkspaceKind := workspacekind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.ServiceAccount.Name = "new-editor"
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("failing to update the `spec.podTemplate.volumeMounts.home` field")
			newWorkspaceKind = workspacekind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.VolumeMounts.Home = "/home/jovyan/new"
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("failing to update the `spec.podTemplate.options.imageConfig.values[0].spec` field")
			newWorkspaceKind = workspacekind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec.Image = "new-image:latest"
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("failing to update the `spec.podTemplate.options.podConfig.values[0].spec` field")
			newWorkspaceKind = workspacekind.DeepCopy()
			newWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec.Resources.Requests[v1.ResourceCPU] = resource.MustParse("99")
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())
		})

		It("should not allow mutually exclusive fields to be set", func() {
			patch := client.MergeFrom(workspacekind.DeepCopy())

			By("only allowing one of `spec.spawner.icon.{url,configMap}` to be set")
			newWorkspaceKind := workspacekind.DeepCopy()
			newWorkspaceKind.Spec.Spawner.Icon = kubefloworgv1beta1.WorkspaceKindIcon{
				Url: ptr.To("https://example.com/icon.png"),
				ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
					Name: "my-logos",
					Key:  "icon.png",
				},
			}
			Expect(k8sClient.Patch(ctx, newWorkspaceKind, patch)).NotTo(Succeed())

			By("only allowing one of `spec.podTemplate.culling.activityProbe.{exec,jupyter}` to be set")
			newWorkspaceKind = workspacekind.DeepCopy()
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
