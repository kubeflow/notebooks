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
	repo "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
	health_check "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/health_check"
)

func TestHealthCheckRepositories(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "HealthCheck Repositories Suite")
}

var _ = Describe("HealthCheckRepository", func() {
	var (
		repos      *repo.Repositories
		healthRepo *health_check.HealthCheckRepository
	)

	BeforeEach(func() {
		repos = repo.NewRepositories(nil)
		healthRepo = repos.HealthCheck
	})

	Context("Repository Initialization", func() {
		It("should initialize with non-nil repository", func() {
			Expect(repos).ToNot(BeNil())
			Expect(healthRepo).ToNot(BeNil())
			Expect(healthRepo).To(BeAssignableToTypeOf(&health_check.HealthCheckRepository{}))
		})
	})

	Context("HealthCheck Functionality", func() {
		It("should return healthy status with valid version", func() {
			version := "1.0.0"
			result, err := healthRepo.HealthCheck(version)
			Expect(err).ToNot(HaveOccurred())
			Expect(result.Status).To(Equal(models.ServiceStatusHealthy))
			Expect(result.SystemInfo.Version).To(Equal(version))
		})
	})
})
