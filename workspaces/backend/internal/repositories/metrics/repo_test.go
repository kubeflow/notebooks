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

package metrics

import (
	"context"
	"errors"
	"testing"
	"time"

	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/resources"
	repoCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/common"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
)

func TestMetricsRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Metrics Repository")
}

var _ = Describe("MetricsRepository.GetWorkspaceResourceUsage", func() {
	var (
		scheme *runtime.Scheme
		ctx    context.Context
	)

	BeforeEach(func() {
		ctx = context.Background()
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(metricsv1beta1.AddToScheme(scheme)).To(Succeed())
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
	})

	It("returns available usage joined with requests when pods and metrics exist", func() {
		pod := workspacePod("pod-1", "container-1", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})
		metrics := workspacePodMetrics("pod-1", "container-1", corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse("50m"),
			corev1.ResourceMemory: resource.MustParse("100Mi"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR(), metrics).
			WithLists(
				&corev1.PodList{Items: []corev1.Pod{*pod}},
			).Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: &models.MetricsFromMetricsServer{
				Timestamp: "0001-01-01T00:00:00Z",
				Usage: models.ResourceValues{
					CPU:    "50m",
					Memory: "100Mi",
				},
			},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-1"]).To(BeComparableTo(expected))
	})

	It("omits metricsFromMetricsServer when PodMetrics is missing", func() {
		pod := workspacePod("pod-2", "container-2", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(
				&corev1.PodList{Items: []corev1.Pod{*pod}},
			).Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: nil,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-2"]).To(BeComparableTo(expected))
	})

	It("returns ErrWorkspaceNotFound when the workspace does not exist", func() {
		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{}}).
			Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "no-such-workspace")

		Expect(err).To(MatchError(repoCommon.ErrWorkspaceNotFound))
		Expect(got).To(BeNil())
	})

	It("returns ErrWorkspacePodNotRunning when no pods match", func() {
		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(
				&corev1.PodList{Items: []corev1.Pod{}},
			).Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).To(MatchError(repoCommon.ErrWorkspacePodNotRunning))
		Expect(got).To(BeNil())
	})

	It("omits metricsFromMetricsServer when API is not served", func() {
		pod := workspacePod("pod-3", "container-3", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			Build()

		repo := newTestMetricsRepository(client, false)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: nil,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-3"]).To(BeComparableTo(expected))
	})

	It("omits metricsFromMetricsServer when PodMetrics returns NotFound", func() {
		pod := workspacePod("pod-4", "container-4", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			WithInterceptorFuncs(interceptor.Funcs{
				Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
					if _, isMetrics := obj.(*metricsv1beta1.PodMetrics); isMetrics {
						return apierrors.NewNotFound(schema.GroupResource{Group: metricsv1beta1.GroupName, Resource: "podmetrics"}, "")
					}
					return cli.Get(ctx, key, obj, opts...)
				},
			}).
			Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: nil,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-4"]).To(BeComparableTo(expected))
	})

	It("omits metricsFromMetricsServer when PodMetrics returns ServiceUnavailable", func() {
		pod := workspacePod("pod-4", "container-4", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			WithInterceptorFuncs(interceptor.Funcs{
				Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
					if _, isMetrics := obj.(*metricsv1beta1.PodMetrics); isMetrics {
						return apierrors.NewServiceUnavailable("metrics service unavailable")
					}
					return cli.Get(ctx, key, obj, opts...)
				},
			}).
			Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: nil,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-4"]).To(BeComparableTo(expected))
	})

	It("omits metricsFromMetricsServer when getting PodMetrics is forbidden", func() {
		pod := workspacePod("pod-4", "container-4", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			WithInterceptorFuncs(interceptor.Funcs{
				Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
					if _, isMetrics := obj.(*metricsv1beta1.PodMetrics); isMetrics {
						return apierrors.NewForbidden(schema.GroupResource{}, "", errors.New("forbidden"))
					}
					return cli.Get(ctx, key, obj, opts...)
				},
			}).
			Build()

		repo := newTestMetricsRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: nil,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-4"]).To(BeComparableTo(expected))
	})

	It("omits metricsFromMetricsServer when availability could not be determined", func() {
		pod := workspacePod("pod-5", "container-5", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			Build()

		repo := &MetricsRepository{
			client:       client,
			apiAvailable: func() bool { return false },
		}
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
		expected := models.ContainerResourceUsage{
			MetricsFromMetricsServer: nil,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
			},
		}

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-5"]).To(BeComparableTo(expected))
	})

	It("propagates context cancellation error when context is canceled while getting metrics", func() {
		pod := workspacePod("pod-6", "container-6", corev1.ResourceList{
			corev1.ResourceCPU: resource.MustParse("100m"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(testWorkspaceCR()).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			WithInterceptorFuncs(interceptor.Funcs{
				Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
					if _, isMetrics := obj.(*metricsv1beta1.PodMetrics); isMetrics {
						return context.Canceled
					}
					return cli.Get(ctx, key, obj, opts...)
				},
			}).
			Build()

		canceledCtx, cancel := context.WithCancel(context.Background())
		cancel()

		repo := newTestMetricsRepository(client, true)
		_, err := repo.GetWorkspaceResourceUsage(canceledCtx, "default", "test-workspace")

		Expect(err).To(MatchError(context.Canceled))
	})
})

var _ = Describe("metricsAPIServed", func() {
	It("reports served when the PodMetrics kind resolved", func() {
		mapper := meta.NewDefaultRESTMapper([]schema.GroupVersion{metricsv1beta1.SchemeGroupVersion})
		mapper.Add(metricsv1beta1.SchemeGroupVersion.WithKind("PodMetrics"), meta.RESTScopeNamespace)
		c := fake.NewClientBuilder().WithRESTMapper(mapper).Build()

		Expect(metricsAPIServed(c)).To(BeTrue())
	})

	It("reports not served when the kind is absent", func() {
		c := fake.NewClientBuilder().WithRESTMapper(meta.NewDefaultRESTMapper(nil)).Build()

		Expect(metricsAPIServed(c)).To(BeFalse())
	})

	It("reports not served when discovery itself fails", func() {
		discoveryErr := errors.New("the server is currently unable to handle the request")
		c := fake.NewClientBuilder().WithRESTMapper(failingRESTMapper{err: discoveryErr}).Build()

		Expect(metricsAPIServed(c)).To(BeFalse())
	})
})

var _ = Describe("memoize", func() {
	It("calls the probe only once within the TTL", func() {
		calls := 0
		available := memoize(time.Minute, func() bool { calls++; return true })

		Expect(available()).To(BeTrue())
		Expect(available()).To(BeTrue())
		Expect(calls).To(Equal(1))
	})

	It("caches a negative result", func() {
		calls := 0
		available := memoize(time.Minute, func() bool { calls++; return false })

		Expect(available()).To(BeFalse())
		Expect(available()).To(BeFalse())
		Expect(calls).To(Equal(1))
	})

	It("re-probes once the TTL has expired", func() {
		calls := 0
		available := memoize(time.Nanosecond, func() bool { calls++; return true })

		available()
		time.Sleep(time.Millisecond)
		available()

		Expect(calls).To(Equal(2))
	})

	It("picks up a change in underlying state after TTL", func() {
		served := false
		available := memoize(time.Nanosecond, func() bool { return served })

		Expect(available()).To(BeFalse())

		served = true
		time.Sleep(time.Millisecond)
		Expect(available()).To(BeTrue())
	})
})

type failingRESTMapper struct {
	meta.RESTMapper
	err error
}

func (m failingRESTMapper) RESTMapping(gk schema.GroupKind, versions ...string) (*meta.RESTMapping, error) {
	return nil, m.err
}

// testWorkspaceCR is the Workspace the specs resolve usage for. GetWorkspaceResourceUsage
// confirms the workspace exists before reading usage, so it must be present in the fake client.
func testWorkspaceCR() *kubefloworgv1beta1.Workspace {
	return &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-workspace",
			Namespace: "default",
		},
	}
}

func newTestMetricsRepository(c client.Client, apiAvailable bool) *MetricsRepository {
	return &MetricsRepository{
		client:       c,
		apiAvailable: func() bool { return apiAvailable },
	}
}

func workspacePod(name, containerName string, requests corev1.ResourceList) *corev1.Pod {
	c := corev1.Container{
		Name: containerName,
	}
	if requests != nil {
		c.Resources = corev1.ResourceRequirements{
			Requests: requests,
		}
	}
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
			Labels: map[string]string{
				modelsCommon.LabelWorkspaceName: "test-workspace",
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{c},
		},
	}
}

func workspacePodMetrics(name, containerName string, usage corev1.ResourceList) *metricsv1beta1.PodMetrics {
	return &metricsv1beta1.PodMetrics{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
			Labels: map[string]string{
				modelsCommon.LabelWorkspaceName: "test-workspace",
			},
		},
		Containers: []metricsv1beta1.ContainerMetrics{
			{
				Name:  containerName,
				Usage: usage,
			},
		},
	}
}
