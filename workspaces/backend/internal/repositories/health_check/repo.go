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

package health_check

import (
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/health_check"
)

type HealthCheckRepository struct{}

func NewHealthCheckRepository() *HealthCheckRepository {
	return &HealthCheckRepository{}
}

func (r *HealthCheckRepository) HealthCheck(version string) (models.HealthCheck, error) {

	var res = models.HealthCheck{
		// TODO: implement actual health check logic
		Status: models.ServiceStatusHealthy,
		SystemInfo: models.SystemInfo{
			Version: version,
		},
	}

	return res, nil
}
