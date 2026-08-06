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
	"testing"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

func TestMetricsModule(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Metrics Module")
}

var _ = Describe("Funcs", func() {

	Describe("NewErrorResourceUsage", func() {
		It("should return a correctly populated WorkspaceResourceUsage", func() {
			errorCode := ErrorCodeWorkspaceNotRunning

			got := NewErrorResourceUsage(errorCode)
			Expect(got).NotTo(BeNil())
			Expect(got.Error).To(Equal(errorCode))
			Expect(got.Containers).To(BeNil())
		})
	})

	Describe("NewWorkspaceResourceUsage", func() {
		It("joins usage with requests and limits for a single container", func() {
			qtyCPU := resource.MustParse("100m")
			qtyMem := resource.MustParse("200Mi")

			pod := podWithContainer("pod-1", container("container-1",
				corev1.ResourceList{
					corev1.ResourceCPU:    qtyCPU,
					corev1.ResourceMemory: qtyMem,
				},
				corev1.ResourceList{
					corev1.ResourceCPU:    qtyCPU,
					corev1.ResourceMemory: qtyMem,
				}))

			usageByContainer := map[string]*MetricsFromMetricsServer{
				"container-1": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU:    "50m",
						Memory: "100Mi",
					},
				},
			}

			got := NewWorkspaceResourceUsage(&pod, usageByContainer)
			expected := ContainerResourceUsage{
				MetricsFromMetricsServer: &MetricsFromMetricsServer{
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU:    "50m",
						Memory: "100Mi",
					},
				},
				Resources: corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceCPU:    qtyCPU,
						corev1.ResourceMemory: qtyMem,
					},
					Limits: corev1.ResourceList{
						corev1.ResourceCPU:    qtyCPU,
						corev1.ResourceMemory: qtyMem,
					},
				},
			}

			Expect(got.Error).To(BeEmpty())
			Expect(got.Containers).To(HaveLen(1))
			Expect(got.Containers["container-1"]).To(BeComparableTo(expected))
		})

		It("reports MetricsFromMetricsServer=nil when the pod has no metrics sample yet", func() {
			pod := podWithContainer("pod-1", container("container-1",
				corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				},
				nil))

			// Empty usage map represents no metrics available yet
			usageByContainer := map[string]*MetricsFromMetricsServer{}

			got := NewWorkspaceResourceUsage(&pod, usageByContainer)

			Expect(got.Error).To(BeEmpty())
			Expect(got.Containers).To(HaveLen(1))

			cUsage := got.Containers["container-1"]
			Expect(cUsage.MetricsFromMetricsServer).To(BeNil())
			Expect(cUsage.Resources.Requests).NotTo(BeNil())
		})

		It("handles multi-container pods where only some containers have usage", func() {
			pod := podWithContainer("pod-1",
				container("container-1", nil, nil),
				container("container-2", nil, nil))

			usageByContainer := map[string]*MetricsFromMetricsServer{
				"container-1": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU: "50m",
					},
				},
				// container-2 is missing from usage map
			}

			got := NewWorkspaceResourceUsage(&pod, usageByContainer)

			Expect(got.Error).To(BeEmpty())
			Expect(got.Containers).To(HaveLen(2))

			c1Usage := got.Containers["container-1"]
			Expect(c1Usage.MetricsFromMetricsServer).NotTo(BeNil())
			Expect(c1Usage.MetricsFromMetricsServer.Usage.CPU).To(Equal("50m"))

			c2Usage := got.Containers["container-2"]
			Expect(c2Usage.MetricsFromMetricsServer).To(BeNil())
		})

		It("omits requests/limits when the container declares none", func() {
			pod := podWithContainer("pod-2", container("container-1", nil, nil))

			usageByContainer := map[string]*MetricsFromMetricsServer{
				"container-1": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU: "50m",
					},
				},
			}

			got := NewWorkspaceResourceUsage(&pod, usageByContainer)

			Expect(got.Error).To(BeEmpty())
			Expect(got.Containers).To(HaveLen(1))

			cUsage := got.Containers["container-1"]
			Expect(cUsage.MetricsFromMetricsServer).NotTo(BeNil())
			Expect(cUsage.Resources.Requests).To(BeNil())
			Expect(cUsage.Resources.Limits).To(BeNil())
		})

		It("returns an error if pod is nil", func() {
			got := NewWorkspaceResourceUsage(nil, nil)

			Expect(got.Error).To(Equal(ErrorCodeWorkspaceNotRunning))
			Expect(got.Containers).To(BeNil())
		})
	})

	Describe("UsageForPod", func() {
		It("indexes container metrics for a matching pod", func() {
			now := time.Date(2026, 6, 20, 12, 0, 0, 0, time.UTC)
			pm := podMetrics("test-pod", now,
				containerMetrics("main", corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("250m"),
					corev1.ResourceMemory: resource.MustParse("512Mi"),
				}),
				containerMetrics("sidecar", corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("10m"),
					corev1.ResourceMemory: resource.MustParse("64Mi"),
				}))

			got := UsageForPod([]metricsv1beta1.PodMetrics{pm}, "test-pod")
			expected := map[string]*MetricsFromMetricsServer{
				"main": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU:    "250m",
						Memory: "512Mi",
					},
				},
				"sidecar": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU:    "10m",
						Memory: "64Mi",
					},
				},
			}

			Expect(got).To(BeComparableTo(expected))
		})

		It("returns nil when no pod in the list matches podName", func() {
			now := time.Date(2026, 6, 20, 12, 0, 0, 0, time.UTC)
			pm := podMetrics("other-pod", now,
				containerMetrics("main", corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("100m"),
				}))

			got := UsageForPod([]metricsv1beta1.PodMetrics{pm}, "target-pod")

			Expect(got).To(BeNil())
		})

		It("returns nil when the podMetrics list is empty", func() {
			got := UsageForPod(nil, "target-pod")

			Expect(got).To(BeNil())
		})

		It("handles containers with partial or missing resource usage", func() {
			now := time.Date(2026, 6, 20, 12, 0, 0, 0, time.UTC)
			pm := podMetrics("test-pod", now,
				containerMetrics("cpu-only", corev1.ResourceList{
					corev1.ResourceCPU: resource.MustParse("50m"),
				}),
				containerMetrics("empty-usage", corev1.ResourceList{}))

			got := UsageForPod([]metricsv1beta1.PodMetrics{pm}, "test-pod")
			expected := map[string]*MetricsFromMetricsServer{
				"cpu-only": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage: ResourceValues{
						CPU: "50m",
					},
				},
				"empty-usage": {
					Timestamp: "2026-06-20T12:00:00Z",
					Usage:     ResourceValues{},
				},
			}

			Expect(got).To(BeComparableTo(expected))
		})
	})
})

func podWithContainer(name string, containers ...corev1.Container) corev1.Pod {
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Spec: corev1.PodSpec{
			Containers: containers,
		},
	}
}

func container(name string, requests, limits corev1.ResourceList) corev1.Container {
	c := corev1.Container{
		Name: name,
	}
	if requests != nil || limits != nil {
		c.Resources = corev1.ResourceRequirements{
			Requests: requests,
			Limits:   limits,
		}
	}
	return c
}

func podMetrics(name string, timestamp time.Time, containers ...metricsv1beta1.ContainerMetrics) metricsv1beta1.PodMetrics {
	return metricsv1beta1.PodMetrics{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Timestamp:  metav1.NewTime(timestamp),
		Containers: containers,
	}
}

func containerMetrics(name string, usage corev1.ResourceList) metricsv1beta1.ContainerMetrics {
	return metricsv1beta1.ContainerMetrics{
		Name:  name,
		Usage: usage,
	}
}
