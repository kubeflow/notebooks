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

	modelsmetrics "github.com/kubeflow/notebooks/workspaces/backend/internal/models/metrics"

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

func TestRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Metrics Repository")
}

var _ = Describe("Repository.GetWorkspaceResourceUsage", func() {
	var (
		scheme *runtime.Scheme
		ctx    context.Context
	)

	BeforeEach(func() {
		ctx = context.Background()
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(metricsv1beta1.AddToScheme(scheme)).To(Succeed())
	})

	It("returns available usage joined with requests when pods and metrics exist", func() {
		pod := workspacePod("pod-1", "container-1")
		metrics := workspacePodMetrics("pod-1", "container-1", corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse("50m"),
			corev1.ResourceMemory: resource.MustParse("100Mi"),
		})

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithLists(
				&corev1.PodList{Items: []corev1.Pod{*pod}},
				&metricsv1beta1.PodMetricsList{Items: []metricsv1beta1.PodMetrics{*metrics}},
			).Build()

		repo := newTestRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Error).To(BeEmpty())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-1"].MetricsFromMetricsServer.Usage.CPU).To(Equal("50m"))
		Expect(got.Containers["container-1"].MetricsFromMetricsServer.Usage.Memory).To(Equal("100Mi"))
		Expect(got.Containers["container-1"].Resources.Requests[corev1.ResourceCPU]).To(Equal(resource.MustParse("100m")))
	})

	It("reports Usage=nil when the pod exists but no metrics yet", func() {
		pod := workspacePod("pod-2", "container-2")

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithLists(
				&corev1.PodList{Items: []corev1.Pod{*pod}},
				&metricsv1beta1.PodMetricsList{Items: []metricsv1beta1.PodMetrics{}},
			).Build()

		repo := newTestRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Error).To(BeEmpty())
		Expect(got.Containers).To(HaveLen(1))
		Expect(got.Containers["container-2"].MetricsFromMetricsServer).To(BeNil())
		Expect(got.Containers["container-2"].Resources.Requests[corev1.ResourceCPU]).To(Equal(resource.MustParse("100m")))
	})

	It("returns WorkspaceNotRunning when the workspace has no pods", func() {
		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithLists(
				&corev1.PodList{Items: []corev1.Pod{}},
			).Build()

		repo := newTestRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Error).To(Equal(modelsmetrics.ErrorCodeWorkspaceNotRunning))
	})

	It("returns MetricsAPINotAvailable when the API is not served by the cluster", func() {
		pod := workspacePod("pod-3", "container-3")

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			Build()

		repo := newTestRepository(client, false)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).NotTo(HaveOccurred())
		Expect(got).NotTo(BeNil())
		Expect(got.Error).To(Equal(modelsmetrics.ErrorCodeMetricsAPINotAvailable))
	})

	It("returns error when the service account is forbidden", func() {
		pod := workspacePod("pod-4", "container-4")

		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*pod}}).
			WithInterceptorFuncs(interceptor.Funcs{
				List: func(ctx context.Context, cli client.WithWatch, list client.ObjectList, opts ...client.ListOption) error {
					if _, isMetricsList := list.(*metricsv1beta1.PodMetricsList); isMetricsList {
						return apierrors.NewForbidden(schema.GroupResource{}, "", errors.New("forbidden"))
					}
					return cli.List(ctx, list, opts...)
				},
			}).
			Build()

		repo := newTestRepository(client, true)
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).To(HaveOccurred())
		Expect(apierrors.IsForbidden(err)).To(BeTrue())
		Expect(got).To(BeNil())
	})

	It("returns error when availability could not be determined", func() {
		client := fake.NewClientBuilder().
			WithScheme(scheme).
			WithLists(&corev1.PodList{Items: []corev1.Pod{*workspacePod("pod-5", "container-5")}}).
			Build()

		probeErr := errors.New("discovery failed")
		repo := &Repository{
			client:       client,
			apiAvailable: func() (bool, error) { return false, probeErr },
		}
		got, err := repo.GetWorkspaceResourceUsage(ctx, "default", "test-workspace")

		Expect(err).To(MatchError(probeErr))
		Expect(got).To(BeNil())
	})
})

var _ = Describe("metricsAPIServed", func() {
	It("reports served when the PodMetrics kind resolved", func() {
		mapper := meta.NewDefaultRESTMapper([]schema.GroupVersion{metricsv1beta1.SchemeGroupVersion})
		mapper.Add(metricsv1beta1.SchemeGroupVersion.WithKind("PodMetrics"), meta.RESTScopeNamespace)
		c := fake.NewClientBuilder().WithRESTMapper(mapper).Build()

		served, err := metricsAPIServed(c)

		Expect(err).NotTo(HaveOccurred())
		Expect(served).To(BeTrue())
	})

	It("reports not served, without an error, when the kind is absent", func() {
		c := fake.NewClientBuilder().WithRESTMapper(meta.NewDefaultRESTMapper(nil)).Build()

		served, err := metricsAPIServed(c)

		Expect(err).NotTo(HaveOccurred())
		Expect(served).To(BeFalse())
	})

	It("reports an error when discovery itself fails", func() {
		discoveryErr := errors.New("the server is currently unable to handle the request")
		c := fake.NewClientBuilder().WithRESTMapper(failingRESTMapper{err: discoveryErr}).Build()

		served, err := metricsAPIServed(c)

		Expect(err).To(MatchError(discoveryErr))
		Expect(err.Error()).To(ContainSubstring("checking metrics.k8s.io availability"))
		Expect(served).To(BeFalse())
	})
})

var _ = Describe("memoize", func() {
	It("calls the probe only once within the TTL", func() {
		calls := 0
		available := memoize(time.Minute, func() (bool, error) { calls++; return true, nil })

		Expect(available()).To(BeTrue())
		Expect(available()).To(BeTrue())
		Expect(calls).To(Equal(1))
	})

	It("caches a negative result", func() {
		calls := 0
		available := memoize(time.Minute, func() (bool, error) { calls++; return false, nil })

		Expect(available()).To(BeFalse())
		Expect(available()).To(BeFalse())
		Expect(calls).To(Equal(1))
	})

	It("re-probes once the TTL has expired", func() {
		calls := 0
		available := memoize(time.Nanosecond, func() (bool, error) { calls++; return true, nil })

		available()
		time.Sleep(time.Millisecond)
		available()

		Expect(calls).To(Equal(2))
	})

	It("picks up a change in underlying state after TTL", func() {
		served := false
		available := memoize(time.Nanosecond, func() (bool, error) { return served, nil })

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

func newTestRepository(c client.Client, apiAvailable bool) *Repository {
	return &Repository{
		client:       c,
		apiAvailable: func() (bool, error) { return apiAvailable, nil },
	}
}

func workspacePod(name, containerName string) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
			Labels: map[string]string{
				LabelWorkspaceName: "test-workspace",
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name: containerName,
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceCPU: resource.MustParse("100m"),
						},
					},
				},
			},
		},
	}
}

func workspacePodMetrics(name, containerName string, usage corev1.ResourceList) *metricsv1beta1.PodMetrics {
	return &metricsv1beta1.PodMetrics{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "default",
			Labels: map[string]string{
				LabelWorkspaceName: "test-workspace",
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
