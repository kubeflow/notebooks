/*
 *
 * Copyright 2024.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

package api

import (
	"context"
	"fmt"
	"path/filepath"
	"runtime"
	"testing"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	ctrl "sigs.k8s.io/controller-runtime"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	//+kubebuilder:scaffold:imports
)

// These tests use Ginkgo (BDD-style Go testing framework). Refer to
// http://onsi.github.io/ginkgo/ to learn more about Ginkgo.

var (
	testEnv *envtest.Environment
	cfg     *rest.Config

	k8sClient client.Client

	ctx    context.Context
	cancel context.CancelFunc
)

func TestAPI(t *testing.T) {
	RegisterFailHandler(Fail)

	RunSpecs(t, "API Suite")
}

const namespaceName = "default"

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))
	ctx, cancel = context.WithCancel(context.Background())

	By("bootstrapping test environment")
	path := filepath.Join("..", "..", "controller", "config", "crd", "bases")
	fmt.Println(path)
	testEnv = &envtest.Environment{
		CRDDirectoryPaths: []string{
			filepath.Join("..", "..", "controller", "config", "crd", "bases"),
		},
		ErrorIfCRDPathMissing: true,

		// The BinaryAssetsDirectory is only required if you want to run the tests directly without call the makefile target test.
		// If not informed it will look for the default path defined in controller-runtime which is /usr/local/kubebuilder/.
		// Note that you must have the required binaries setup under the bin directory to perform the tests directly.
		// When we run make test it will be setup and used automatically.
		BinaryAssetsDirectory: filepath.Join("..", "bin", "k8s", fmt.Sprintf("1.29.0-%s-%s", runtime.GOOS, runtime.GOARCH)),
	}
	var err error
	cfg, err = testEnv.Start()
	Expect(err).NotTo(HaveOccurred())
	Expect(cfg).NotTo(BeNil())

	By("setting up the scheme")
	err = kubefloworgv1beta1.AddToScheme(scheme.Scheme)
	Expect(err).NotTo(HaveOccurred())

	By("creating the k8s client")
	k8sClient, err = client.New(cfg, client.Options{Scheme: scheme.Scheme})
	Expect(err).NotTo(HaveOccurred())
	Expect(k8sClient).NotTo(BeNil())

	By("setting up the controller manager")
	k8sManager, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: scheme.Scheme,
		Metrics: metricsserver.Options{
			BindAddress: "0", // disable metrics serving
		},
	})
	Expect(err).NotTo(HaveOccurred())

	go func() {
		defer GinkgoRecover()
		err = k8sManager.Start(ctx)
		Expect(err).NotTo(HaveOccurred(), "failed to run manager")
	}()

})

var _ = AfterSuite(func() {
	By("stopping the manager")
	cancel()

	By("tearing down the test environment")
	err := testEnv.Stop()
	Expect(err).NotTo(HaveOccurred())
})

// NewExampleWorkspace returns the common "Workspace" object used in tests.
func NewExampleWorkspace(name string, namespace string, workspaceKind string) *kubefloworgv1beta1.Workspace {
	return &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:       ptr.To(false),
			DeferUpdates: ptr.To(false),
			Kind:         workspaceKind,
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
					Labels:      nil,
					Annotations: nil,
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
					Home: ptr.To("my-home-pvc"),
					Data: []kubefloworgv1beta1.PodVolumeMount{
						{
							PVCName:   "my-repositories-pvc",
							MountPath: "/repositories/my-repositories",
							ReadOnly:  ptr.To(false),
						},
					},
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: "jupyterlab_scipy_180",
					PodConfig:   "tiny_cpu",
				},
			},
		},
	}
}

// NewExampleWorkspaceKind returns the common "WorkspaceKind" object used in tests.
func NewExampleWorkspaceKind(name string) *kubefloworgv1beta1.WorkspaceKind {
	return &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
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
						Name:      "my-logos",
						Namespace: namespaceName,
						Key:       "apple-touch-icon-152x152.png",
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
					MaxInactiveSeconds: ptr.To(int32(86400)),
					ActivityProbe: kubefloworgv1beta1.ActivityProbe{
						Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{
							LastActivity: true,
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
						Value: `{{ httpPathPrefix "jupyterlab" }}`,
					},
				},
				ExtraVolumeMounts: []v1.VolumeMount{
					{
						Name:      "dshm",
						MountPath: "/dev/shm",
					},
				},
				ExtraVolumes: []v1.Volume{
					{
						Name: "dshm",
						VolumeSource: v1.VolumeSource{
							EmptyDir: &v1.EmptyDirVolumeSource{
								Medium: v1.StorageMediumMemory,
							},
						},
					},
				},
				SecurityContext: &v1.PodSecurityContext{
					FSGroup: ptr.To(int64(100)),
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
						Spawner: kubefloworgv1beta1.OptionsSpawnerConfig{
							Default: "jupyterlab_scipy_190",
						},
						Values: []kubefloworgv1beta1.ImageConfigValue{
							{
								// WARNING: do not change the ID of this value or remove it, it is used in the tests
								Id: "jupyterlab_scipy_180",
								Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
									DisplayName: "jupyter-scipy:v1.8.0",
									Description: ptr.To("JupyterLab, with SciPy Packages"),
									Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
										{
											Key:   "python_version",
											Value: "3.11",
										},
									},
									Hidden: ptr.To(true),
								},
								Redirect: &kubefloworgv1beta1.OptionRedirect{
									To: "jupyterlab_scipy_190",
									Message: &kubefloworgv1beta1.RedirectMessage{
										Level: "Info",
										Text:  "This update will change...",
									},
								},
								Spec: kubefloworgv1beta1.ImageConfigSpec{
									Image: "docker.io/kubeflownotebookswg/jupyter-scipy:v1.8.0",
									Ports: []kubefloworgv1beta1.ImagePort{
										{
											Id:          "jupyterlab",
											DisplayName: "JupyterLab",
											Port:        8888,
											Protocol:    "HTTP",
										},
									},
								},
							},
							{
								// WARNING: do not change the ID of this value or remove it, it is used in the tests
								Id: "jupyterlab_scipy_190",
								Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
									DisplayName: "jupyter-scipy:v1.9.0",
									Description: ptr.To("JupyterLab, with SciPy Packages"),
									Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
										{
											Key:   "python_version",
											Value: "3.11",
										},
									},
								},
								Spec: kubefloworgv1beta1.ImageConfigSpec{
									Image: "docker.io/kubeflownotebookswg/jupyter-scipy:v1.9.0",
									Ports: []kubefloworgv1beta1.ImagePort{
										{
											Id:          "jupyterlab",
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
						Spawner: kubefloworgv1beta1.OptionsSpawnerConfig{
							Default: "tiny_cpu",
						},
						Values: []kubefloworgv1beta1.PodConfigValue{
							{
								// WARNING: do not change the ID of this value or remove it, it is used in the tests
								Id: "tiny_cpu",
								Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
									DisplayName: "Tiny CPU",
									Description: ptr.To("Pod with 0.1 CPU, 128 MB RAM"),
									Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
										{
											Key:   "cpu",
											Value: "100m",
										},
										{
											Key:   "memory",
											Value: "128Mi",
										},
									},
								},
								Spec: kubefloworgv1beta1.PodConfigSpec{
									Resources: &v1.ResourceRequirements{
										Requests: map[v1.ResourceName]resource.Quantity{
											v1.ResourceCPU:    resource.MustParse("100m"),
											v1.ResourceMemory: resource.MustParse("128Mi"),
										},
									},
								},
							},
							{
								// WARNING: do not change the ID of this value or remove it, it is used in the tests
								Id: "small_cpu",
								Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
									DisplayName: "Small CPU",
									Description: ptr.To("Pod with 1 CPU, 2 GB RAM"),
									Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
										{
											Key:   "cpu",
											Value: "1000m",
										},
										{
											Key:   "memory",
											Value: "2Gi",
										},
									},
								},
								Spec: kubefloworgv1beta1.PodConfigSpec{
									Resources: &v1.ResourceRequirements{
										Requests: map[v1.ResourceName]resource.Quantity{
											v1.ResourceCPU:    resource.MustParse("1000m"),
											v1.ResourceMemory: resource.MustParse("2Gi"),
										},
									},
								},
							},
							{
								// WARNING: do not change the ID of this value or remove it, it is used in the tests
								Id: "big_gpu",
								Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
									DisplayName: "Big GPU",
									Description: ptr.To("Pod with 4 CPU, 16 GB RAM, and 1 GPU"),
									Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
										{
											Key:   "cpu",
											Value: "4000m",
										},
										{
											Key:   "memory",
											Value: "16Gi",
										},
										{
											Key:   "gpu",
											Value: "1",
										},
									},
								},
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
											v1.ResourceCPU:    resource.MustParse("4000m"),
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
}
