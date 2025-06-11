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

	repo "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
	health_check "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/health_check"
)

func TestNewRepositories_HealthCheck(t *testing.T) {
	// Test with nil client since HealthCheck doesn't need a client
	repos := repo.NewRepositories(nil)

	if repos == nil {
		t.Fatal("NewRepositories returned nil")
	}

	// Focus only on HealthCheck repository testing
	t.Run("HealthCheck repository is initialized", func(t *testing.T) {
		if repos.HealthCheck == nil {
			t.Error("HealthCheck repository is nil")
		}

		// Verify it's the correct type
		if _, ok := interface{}(repos.HealthCheck).(*health_check.HealthCheckRepository); !ok {
			t.Error("HealthCheck repository is not of correct type")
		}
	})
}

func TestHealthCheckRepository_Access(t *testing.T) {
	// Create repositories
	repos := repo.NewRepositories(nil)

	if repos.HealthCheck == nil {
		t.Fatal("HealthCheck repository is nil")
	}

	// Test that we can access the HealthCheck repository
	healthRepo := repos.HealthCheck
	if healthRepo == nil {
		t.Error("Cannot access HealthCheck repository")
	}

	// Verify type assertion works
	if _, ok := interface{}(healthRepo).(*health_check.HealthCheckRepository); !ok {
		t.Error("HealthCheck repository type assertion failed")
	}
}

func TestRepositoriesStruct_HealthCheckField(t *testing.T) {
	repos := repo.NewRepositories(nil)

	// Test that the HealthCheck field is accessible
	_ = repos.HealthCheck

	// Test that we can assign it
	originalHealthCheck := repos.HealthCheck
	if originalHealthCheck == nil {
		t.Error("HealthCheck field should not be nil")
	}
}

// Test that NewRepositories doesn't panic with nil client
func TestNewRepositories_DoesNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("NewRepositories panicked with nil client: %v", r)
		}
	}()

	repos := repo.NewRepositories(nil)
	if repos == nil {
		t.Error("NewRepositories returned nil")
	}
}

// Benchmark test focusing on HealthCheck initialization
func BenchmarkNewRepositories_HealthCheck(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		repos := repo.NewRepositories(nil)
		_ = repos.HealthCheck
	}
}
