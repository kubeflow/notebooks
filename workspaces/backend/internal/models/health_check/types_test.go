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

package health_check_test

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/health_check"
)

func TestHealthCheck(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "HealthCheck Suite")
}

var _ = Describe("HealthCheck Types", func() {
	Context("ServiceStatus constants", func() {
		It("should have expected string values", func() {
			Expect(string(models.ServiceStatusHealthy)).To(Equal("Healthy"))
			Expect(string(models.ServiceStatusUnhealthy)).To(Equal("Unhealthy"))
		})
	})

	Context("HealthCheck struct", func() {
		It("should hold correct values", func() {
			hc := models.HealthCheck{
				Status:     models.ServiceStatusHealthy,
				SystemInfo: models.SystemInfo{Version: "1.2.3"},
			}

			Expect(hc.Status).To(Equal(models.ServiceStatusHealthy))
			Expect(hc.SystemInfo.Version).To(Equal("1.2.3"))
		})

		It("should create a new HealthCheck using the constructor", func() {
			hc := models.NewHealthCheck(models.ServiceStatusUnhealthy, "9.9.9")

			Expect(hc.Status).To(Equal(models.ServiceStatusUnhealthy))
			Expect(hc.SystemInfo.Version).To(Equal("9.9.9"))
		})
	})
})
