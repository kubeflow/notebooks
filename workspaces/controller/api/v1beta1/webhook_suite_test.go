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
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	admissionv1 "k8s.io/api/admission/v1"
	//+kubebuilder:scaffold:imports
	apimachineryruntime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
)

// These tests use Ginkgo (BDD-style Go testing framework). Refer to
// http://onsi.github.io/ginkgo/ to learn more about Ginkgo.

var (
	cfg           *rest.Config
	k8sTestClient client.Client
	testEnv       *envtest.Environment
	ctx           context.Context
	cancel        context.CancelFunc
)

func TestAPIs(t *testing.T) {
	RegisterFailHandler(Fail)

	RunSpecs(t, "Webhook Suite")
}

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))

	ctx, cancel = context.WithCancel(context.TODO())

	By("bootstrapping test environment")
	testEnv = &envtest.Environment{
		CRDDirectoryPaths:     []string{filepath.Join("..", "..", "config", "crd", "bases")},
		ErrorIfCRDPathMissing: false,

		// The BinaryAssetsDirectory is only required if you want to run the tests directly
		// without call the makefile target test. If not informed it will look for the
		// default path defined in controller-runtime which is /usr/local/kubebuilder/.
		// Note that you must have the required binaries setup under the bin directory to perform
		// the tests directly. When we run make test it will be setup and used automatically.
		BinaryAssetsDirectory: filepath.Join("..", "..", "bin", "k8s",
			fmt.Sprintf("1.29.0-%s-%s", runtime.GOOS, runtime.GOARCH)),

		WebhookInstallOptions: envtest.WebhookInstallOptions{
			Paths: []string{filepath.Join("..", "..", "config", "webhook")},
		},
	}

	var err error
	// cfg is defined in this file globally.
	cfg, err = testEnv.Start()
	Expect(err).NotTo(HaveOccurred())
	Expect(cfg).NotTo(BeNil())

	scheme := apimachineryruntime.NewScheme()
	err = AddToScheme(scheme)
	Expect(err).NotTo(HaveOccurred())

	err = admissionv1.AddToScheme(scheme)
	Expect(err).NotTo(HaveOccurred())

	//+kubebuilder:scaffold:scheme

	k8sTestClient, err = client.New(cfg, client.Options{Scheme: scheme})
	Expect(err).NotTo(HaveOccurred())
	Expect(k8sTestClient).NotTo(BeNil())

	// start webhook server using Manager
	webhookInstallOptions := &testEnv.WebhookInstallOptions
	mgr, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: scheme,
		WebhookServer: webhook.NewServer(webhook.Options{
			Host:    webhookInstallOptions.LocalServingHost,
			Port:    webhookInstallOptions.LocalServingPort,
			CertDir: webhookInstallOptions.LocalServingCertDir,
		}),
		LeaderElection: false,
		Metrics:        metricsserver.Options{BindAddress: "0"},
	})
	Expect(err).NotTo(HaveOccurred())

	err = (&WorkspaceKind{}).SetupWebhookWithManager(mgr)
	Expect(err).NotTo(HaveOccurred())

	// Indexing `.spec.kind` here, not in SetupWebhookWithManager, to avoid conflicts with existing indexing.
	// This indexing is specifically for testing purposes to index `Workspace` by `WorkspaceKind`.
	err = mgr.GetFieldIndexer().IndexField(context.Background(), &Workspace{}, kbCacheWorkspaceKindField, func(rawObj client.Object) []string {
		ws := rawObj.(*Workspace)
		if ws.Spec.Kind == "" {
			return nil
		}
		return []string{ws.Spec.Kind}
	})
	Expect(err).NotTo(HaveOccurred())
	err = (&Workspace{}).SetupWebhookWithManager(mgr)
	Expect(err).NotTo(HaveOccurred())

	//+kubebuilder:scaffold:webhook

	go func() {
		defer GinkgoRecover()
		err = mgr.Start(ctx)
		Expect(err).NotTo(HaveOccurred())
	}()

	// wait for the webhook server to get ready
	dialer := &net.Dialer{Timeout: time.Second}
	addrPort := fmt.Sprintf("%s:%d", webhookInstallOptions.LocalServingHost, webhookInstallOptions.LocalServingPort)
	Eventually(func() error {
		conn, err := tls.DialWithDialer(dialer, "tcp", addrPort, &tls.Config{InsecureSkipVerify: true})
		if err != nil {
			return err
		}
		return conn.Close()
	}).Should(Succeed())

})

var _ = AfterSuite(func() {
	cancel()
	By("tearing down the test environment")
	err := testEnv.Stop()
	Expect(err).NotTo(HaveOccurred())
})

// NewExampleWorkspaceKind returns the common "WorkspaceKind" object used in tests.
func NewExampleWorkspaceKind(name string) *WorkspaceKind {
	return &WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Spec: WorkspaceKindSpec{
			Spawner: WorkspaceKindSpawner{
				DisplayName:        "JupyterLab Notebook",
				Description:        "A Workspace which runs JupyterLab in a Pod",
				Hidden:             ptr.To(false),
				Deprecated:         ptr.To(false),
				DeprecationMessage: ptr.To("This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind."),
				Icon: WorkspaceKindIcon{
					Url: ptr.To("https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png"),
				},
				Logo: WorkspaceKindIcon{
					ConfigMap: &WorkspaceKindConfigMap{
						Name: "my-logos",
						Key:  "apple-touch-icon-152x152.png",
					},
				},
			},
			PodTemplate: WorkspaceKindPodTemplate{
				PodMetadata: &WorkspaceKindPodMetadata{},
				ServiceAccount: WorkspaceKindServiceAccount{
					Name: "default-editor",
				},
				Culling: &WorkspaceKindCullingConfig{
					Enabled:            ptr.To(true),
					MaxInactiveSeconds: ptr.To(int32(86400)),
					ActivityProbe: ActivityProbe{
						Jupyter: &ActivityProbeJupyter{
							LastActivity: true,
						},
					},
				},
				Probes: &WorkspaceKindProbes{},
				VolumeMounts: WorkspaceKindVolumeMounts{
					Home: "/home/jovyan",
				},
				HTTPProxy: &HTTPProxy{
					RemovePathPrefix: ptr.To(false),
					RequestHeaders: &IstioHeaderOperations{
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
				Options: WorkspaceKindPodOptions{
					ImageConfig: ImageConfig{
						Spawner: OptionsSpawnerConfig{
							Default: "jupyterlab_scipy_190",
						},
						Values: []ImageConfigValue{
							{
								Id: "jupyterlab_scipy_180",
								Spawner: OptionSpawnerInfo{
									DisplayName: "jupyter-scipy:v1.8.0",
									Description: ptr.To("JupyterLab, with SciPy Packages"),
									Labels: []OptionSpawnerLabel{
										{
											Key:   "python_version",
											Value: "3.11",
										},
									},
									Hidden: ptr.To(true),
								},
								Redirect: &OptionRedirect{
									To: "jupyterlab_scipy_190",
									Message: &RedirectMessage{
										Level: "Info",
										Text:  "This update will change...",
									},
								},
								Spec: ImageConfigSpec{
									Image: "docker.io/kubeflownotebookswg/jupyter-scipy:v1.8.0",
									Ports: []ImagePort{
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
								Id: "jupyterlab_scipy_190",
								Spawner: OptionSpawnerInfo{
									DisplayName: "jupyter-scipy:v1.9.0",
									Description: ptr.To("JupyterLab, with SciPy Packages"),
									Labels: []OptionSpawnerLabel{
										{
											Key:   "python_version",
											Value: "3.11",
										},
									},
								},
								Spec: ImageConfigSpec{
									Image: "docker.io/kubeflownotebookswg/jupyter-scipy:v1.9.0",
									Ports: []ImagePort{
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
					PodConfig: PodConfig{
						Spawner: OptionsSpawnerConfig{
							Default: "tiny_cpu",
						},
						Values: []PodConfigValue{
							{
								Id: "tiny_cpu",
								Spawner: OptionSpawnerInfo{
									DisplayName: "Tiny CPU",
									Description: ptr.To("Pod with 0.1 CPU, 128 MB RAM"),
									Labels: []OptionSpawnerLabel{
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
								Spec: PodConfigSpec{
									Resources: &v1.ResourceRequirements{
										Requests: map[v1.ResourceName]resource.Quantity{
											v1.ResourceCPU:    resource.MustParse("100m"),
											v1.ResourceMemory: resource.MustParse("128Mi"),
										},
									},
								},
							},
							{
								Id: "small_cpu",
								Spawner: OptionSpawnerInfo{
									DisplayName: "Small CPU",
									Description: ptr.To("Pod with 1 CPU, 2 GB RAM"),
									Labels: []OptionSpawnerLabel{
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
								Spec: PodConfigSpec{
									Resources: &v1.ResourceRequirements{
										Requests: map[v1.ResourceName]resource.Quantity{
											v1.ResourceCPU:    resource.MustParse("1000m"),
											v1.ResourceMemory: resource.MustParse("2Gi"),
										},
									},
								},
							},
							{
								Id: "big_gpu",
								Spawner: OptionSpawnerInfo{
									DisplayName: "Big GPU",
									Description: ptr.To("Pod with 4 CPU, 16 GB RAM, and 1 GPU"),
									Labels: []OptionSpawnerLabel{
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
								Spec: PodConfigSpec{
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

// NewExampleWorkspaceKindWithImageConfigCycle returns a WorkspaceKind with a cycle in the ImageConfig options.
func NewExampleWorkspaceKindWithImageConfigCycle(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &OptionRedirect{
		To: "jupyterlab_scipy_180",
	}
	return workspaceKind
}

// NewExampleWorkspaceKindWithPodConfigCycle returns a WorkspaceKind with a cycle in the PodConfig options.
func NewExampleWorkspaceKindWithPodConfigCycle(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &OptionRedirect{
		To: "small_cpu",
		Message: &RedirectMessage{
			Level: "Info",
			Text:  "This update will change...",
		},
	}
	workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[1].Redirect = &OptionRedirect{
		To: "tiny_cpu",
	}

	return workspaceKind
}

// NewExampleWorkspaceKindWithInvalidImageConfig returns a WorkspaceKind with an invalid redirect in the ImageConfig options.
func NewExampleWorkspaceKindWithInvalidImageConfig(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &OptionRedirect{
		To: "invalid_image_config",
	}

	return workspaceKind
}

// NewExampleWorkspaceKindWithInvalidPodConfig returns a WorkspaceKind with an invalid redirect in the PodConfig options.
func NewExampleWorkspaceKindWithInvalidPodConfig(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &OptionRedirect{
		To: "invalid_pod_config",
	}

	return workspaceKind
}

// NewExampleWorkspaceKindWithMissingDefaultImageConfig returns a WorkspaceKind with missing default image config.
func NewExampleWorkspaceKindWithInvalidDefaultImageConfig(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.ImageConfig.Spawner.Default = "invalid_image_config"
	return workspaceKind
}

// NewExampleWorkspaceKindWithMissingDefaultPodConfig returns a WorkspaceKind with missing default pod config.
func NewExampleWorkspaceKindWithInvalidDefaultPodConfig(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.PodConfig.Spawner.Default = "invalid_pod_config"
	return workspaceKind
}

// NewExampleWorkspaceKindWithInvalidExtraEnvValue returns a WorkspaceKind with an invalid extraEnv value.
func NewExampleWorkspaceKindWithDuplicatePorts(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec.Ports = []ImagePort{
		{
			Id:          "jupyterlab",
			DisplayName: "JupyterLab",
			Port:        8888,
			Protocol:    "HTTP",
		},
		{
			Id:          "jupyterlab2",
			DisplayName: "JupyterLab2",
			Port:        8888,
			Protocol:    "HTTP",
		},
	}
	return workspaceKind
}

// NewExampleWorkspaceKindWithInvalidExtraEnvValue returns a WorkspaceKind with an invalid extraEnv value.
func NewExampleWorkspaceKindWithInvalidExtraEnvValue(name string) *WorkspaceKind {
	workspaceKind := NewExampleWorkspaceKind(name)
	workspaceKind.Spec.PodTemplate.ExtraEnv = []v1.EnvVar{
		{
			Name:  "NB_PREFIX",
			Value: `{{ httpPathPrefix "jupyterlab" }`,
		},
	}
	return workspaceKind
}

// NewExampleWorkspace returns the common "Workspace" object used in tests.
func NewExampleWorkspace(name, namespace, workspaceKindName string) *Workspace {
	return &Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: WorkspaceSpec{
			Kind: workspaceKindName,
			PodTemplate: WorkspacePodTemplate{Options: WorkspacePodOptions{
				ImageConfig: "jupyterlab_scipy_180",
				PodConfig:   "tiny_cpu",
			},
			},
		},
	}
}
