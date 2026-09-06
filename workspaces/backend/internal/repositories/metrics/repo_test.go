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
	"fmt"
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
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/cache"
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, false, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
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

		repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)
		_, err := repo.GetWorkspaceResourceUsage(canceledCtx, "default", "test-workspace")

		Expect(err).To(MatchError(context.Canceled))
	})

	Context("with resource usage TTL cache", func() {
		It("returns cached response on repeated calls without querying client again", func() {
			pod := workspacePod("pod-cached", "container-cached", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("100m"),
			})
			metrics := workspacePodMetrics("pod-cached", "container-cached", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("75m"),
			})

			podMetricsGetCount := 0
			client := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(testWorkspaceCR(), metrics).
				WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
				WithInterceptorFuncs(interceptor.Funcs{
					Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
						if _, isMetrics := obj.(*metricsv1beta1.PodMetrics); isMetrics {
							podMetricsGetCount++
						}
						return cli.Get(ctx, key, obj, opts...)
					},
				}).
				Build()

			repo := newTestMetricsRepository(client, true, resourceUsageCacheMaxCapacity)

			// First call (cache miss)
			firstResult, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
			Expect(err).NotTo(HaveOccurred())
			Expect(firstResult).NotTo(BeNil())
			Expect(podMetricsGetCount).To(Equal(1))

			// Second call (cache hit)
			secondResult, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
			Expect(err).NotTo(HaveOccurred())
			Expect(secondResult).To(Equal(firstResult))
			// PodMetrics should NOT have been queried again
			Expect(podMetricsGetCount).To(Equal(1))
		})

		It("invalidates cached entry when pod UID changes due to pod restart or spec update", func() {
			pod1 := workspacePod("pod-1", "container-1", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("100m"),
			})
			pod1.UID = types.UID("uid-pod-1")
			metrics1 := workspacePodMetrics("pod-1", "container-1", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("50m"),
			})

			pod2 := workspacePod("pod-1", "container-1", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("200m"),
			})
			pod2.UID = types.UID("uid-pod-2")
			metrics2 := workspacePodMetrics("pod-1", "container-1", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("150m"),
			})

			fakeCli := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(testWorkspaceCR(), pod1, metrics1).
				Build()

			repo := newTestMetricsRepository(fakeCli, true, resourceUsageCacheMaxCapacity)

			// Query pod1 (populates cache with uid-pod-1)
			firstResult, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
			Expect(err).NotTo(HaveOccurred())
			Expect(firstResult.Containers["container-1"].Resources.Requests[corev1.ResourceCPU]).To(Equal(resource.MustParse("100m")))
			Expect(firstResult.Containers["container-1"].MetricsFromMetricsServer.Usage.CPU).To(Equal("50m"))

			// Simulate pod restart/update with new UID and updated requests
			Expect(fakeCli.Delete(ctx, pod1)).To(Succeed())
			Expect(fakeCli.Create(ctx, pod2)).To(Succeed())
			Expect(fakeCli.Delete(ctx, metrics1)).To(Succeed())
			Expect(fakeCli.Create(ctx, metrics2)).To(Succeed())

			// Query again -> cached entry has old UID, so it fetches pod2
			secondResult, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
			Expect(err).NotTo(HaveOccurred())
			Expect(secondResult.Containers["container-1"].Resources.Requests[corev1.ResourceCPU]).To(Equal(resource.MustParse("200m")))
			Expect(secondResult.Containers["container-1"].MetricsFromMetricsServer.Usage.CPU).To(Equal("150m"))
		})

		It("does not cache when PodMetrics is unavailable so subsequent requests can pick up metrics", func() {
			pod := workspacePod("pod-nocache", "container-nocache", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("100m"),
			})
			fakeCli := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(testWorkspaceCR(), pod).
				Build()

			repo := newTestMetricsRepository(fakeCli, true, resourceUsageCacheMaxCapacity)
			cacheKey := fmt.Sprintf("default/test-workspace/%s", pod.UID)

			got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
			Expect(err).NotTo(HaveOccurred())
			Expect(got).NotTo(BeNil())
			Expect(got.Containers["container-nocache"].MetricsFromMetricsServer).To(BeNil())

			// Ensure nothing was cached
			_, inCache := repo.usageCache.Get(cacheKey)
			Expect(inCache).To(BeFalse())
		})

		It("does not cache when PodMetrics has no container metrics so subsequent requests can pick up metrics", func() {
			pod := workspacePod("pod-nocache-empty", "container-nocache-empty", corev1.ResourceList{
				corev1.ResourceCPU: resource.MustParse("100m"),
			})
			emptyMetrics := &metricsv1beta1.PodMetrics{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "pod-nocache-empty",
					Namespace: "default",
				},
				Containers: []metricsv1beta1.ContainerMetrics{},
			}
			fakeCli := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(testWorkspaceCR(), pod, emptyMetrics).
				Build()

			repo := newTestMetricsRepository(fakeCli, true, resourceUsageCacheMaxCapacity)
			cacheKey := fmt.Sprintf("default/test-workspace/%s", pod.UID)

			got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")
			Expect(err).NotTo(HaveOccurred())
			Expect(got).NotTo(BeNil())
			Expect(got.Containers["container-nocache-empty"].MetricsFromMetricsServer).To(BeNil())

			// Ensure nothing was cached
			_, inCache := repo.usageCache.Get(cacheKey)
			Expect(inCache).To(BeFalse())
		})

		It("evicts oldest entries when cache capacity is exceeded", func() {
			ws1 := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws-1", Namespace: "default"}}
			ws2 := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws-2", Namespace: "default"}}
			ws3 := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws-3", Namespace: "default"}}

			pod1 := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{Name: "pod-1", Namespace: "default", UID: "uid-pod-1", Labels: map[string]string{modelsCommon.LabelWorkspaceName: "ws-1"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c1"}}},
			}
			pod2 := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{Name: "pod-2", Namespace: "default", UID: "uid-pod-2", Labels: map[string]string{modelsCommon.LabelWorkspaceName: "ws-2"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c2"}}},
			}
			pod3 := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{Name: "pod-3", Namespace: "default", UID: "uid-pod-3", Labels: map[string]string{modelsCommon.LabelWorkspaceName: "ws-3"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c3"}}},
			}

			metrics1 := workspacePodMetrics("pod-1", "c1", nil)
			metrics2 := workspacePodMetrics("pod-2", "c2", nil)
			metrics3 := workspacePodMetrics("pod-3", "c3", nil)

			metricsQueryCount := make(map[string]int)
			client := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(ws1, ws2, ws3, pod1, pod2, pod3, metrics1, metrics2, metrics3).
				WithInterceptorFuncs(interceptor.Funcs{
					Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
						if _, isMetrics := obj.(*metricsv1beta1.PodMetrics); isMetrics {
							metricsQueryCount[key.Name]++
						}
						return cli.Get(ctx, key, obj, opts...)
					},
				}).
				Build()

			// Create repository with capacity = 2
			repo := newTestMetricsRepository(client, true, 2)

			// Query ws-1 (cache miss -> queries pod-1 metrics)
			_, err := repo.GetWorkspaceResourceUsage(ctx, "default", "ws-1")
			Expect(err).NotTo(HaveOccurred())
			Expect(metricsQueryCount["pod-1"]).To(Equal(1))

			// Query ws-2 (cache miss -> queries pod-2 metrics)
			_, err = repo.GetWorkspaceResourceUsage(ctx, "default", "ws-2")
			Expect(err).NotTo(HaveOccurred())
			Expect(metricsQueryCount["pod-2"]).To(Equal(1))

			// Query ws-1 again (cache hit -> metrics query count stays 1; ws-1 becomes MRU)
			_, err = repo.GetWorkspaceResourceUsage(ctx, "default", "ws-1")
			Expect(err).NotTo(HaveOccurred())
			Expect(metricsQueryCount["pod-1"]).To(Equal(1))

			// Query ws-3 (cache miss -> queries pod-3 metrics; capacity is 2 so ws-2 is evicted)
			_, err = repo.GetWorkspaceResourceUsage(ctx, "default", "ws-3")
			Expect(err).NotTo(HaveOccurred())
			Expect(metricsQueryCount["pod-3"]).To(Equal(1))

			// Query ws-2 (was evicted -> miss, queries pod-2 metrics again, count becomes 2)
			_, err = repo.GetWorkspaceResourceUsage(ctx, "default", "ws-2")
			Expect(err).NotTo(HaveOccurred())
			Expect(metricsQueryCount["pod-2"]).To(Equal(2))
		})
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

func newTestMetricsRepository(c client.Client, apiAvailable bool, cacheCapacity int) *MetricsRepository {
	return &MetricsRepository{
		client:       c,
		apiAvailable: func() bool { return apiAvailable },
		usageCache:   cache.NewLRUExpireCache(cacheCapacity),
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
			UID:       types.UID("uid-" + name),
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
