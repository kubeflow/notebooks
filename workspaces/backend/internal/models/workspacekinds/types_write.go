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

package workspacekinds

import (
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// WorkspaceKindUpdate represents the full WorkspaceKind spec for update operations.
// Validation is deferred to the Kubernetes API server and controller webhooks.
type WorkspaceKindUpdate struct {
	// Revision is an opaque token for optimistic locking.
	Revision string `json:"revision"`

	// Spawner contains the full spawner configuration.
	Spawner kubefloworgv1beta1.WorkspaceKindSpawner `json:"spawner"`

	// PodTemplate contains the full pod template configuration.
	PodTemplate kubefloworgv1beta1.WorkspaceKindPodTemplate `json:"podTemplate"`
}

// Validate validates the WorkspaceKindUpdate struct.
func (w *WorkspaceKindUpdate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate revision is present
	revisionPath := prefix.Child("revision")
	if w.Revision == "" {
		errs = append(errs, field.Required(revisionPath, "revision is required"))
	}

	// NOTE: all other validation is deferred to the Kubernetes API server

	return errs
}
