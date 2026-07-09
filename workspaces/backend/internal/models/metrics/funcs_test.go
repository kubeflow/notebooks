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

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

			Expect(got.Error).To(BeEmpty())
			Expect(got.Containers).To(HaveLen(1))

			cUsage := got.Containers["container-1"]
			Expect(cUsage.MetricsFromMetricsServer).NotTo(BeNil())
			Expect(cUsage.MetricsFromMetricsServer.Timestamp).To(Equal("2026-06-20T12:00:00Z"))
			Expect(cUsage.MetricsFromMetricsServer.Usage.CPU).To(Equal("50m"))
			Expect(cUsage.MetricsFromMetricsServer.Usage.Memory).To(Equal("100Mi"))
			Expect(cUsage.Resources.Requests[corev1.ResourceCPU]).To(Equal(qtyCPU))
			Expect(cUsage.Resources.Limits[corev1.ResourceCPU]).To(Equal(qtyCPU))
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
