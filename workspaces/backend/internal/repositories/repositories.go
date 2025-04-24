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

package repositories

import (
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/health_check"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/namespaces"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

// Repositories is a single convenient container to hold and represent all our repositories.
type Repositories struct {
	HealthCheck   *health_check.HealthCheckRepository
	Namespace     *namespaces.NamespaceRepository
	Workspace     *workspaces.WorkspaceRepository
	WorkspaceKind *workspacekinds.WorkspaceKindRepository
}

// NewRepositories creates a new Repositories instance from a controller-runtime client.
func NewRepositories(cl client.Client) *Repositories {
	return &Repositories{
		HealthCheck:   health_check.NewHealthCheckRepository(),
		Namespace:     namespaces.NewNamespaceRepository(cl),
		Workspace:     workspaces.NewWorkspaceRepository(cl),
		WorkspaceKind: workspacekinds.NewWorkspaceKindRepository(cl),
	}
}
