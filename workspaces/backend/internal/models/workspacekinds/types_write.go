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

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// WorkspaceKindCreate represents the full WorkspaceKind spec for create operations.
type WorkspaceKindCreate struct {
	Name        string                                      `json:"name"`
	Spawner     kubefloworgv1beta1.WorkspaceKindSpawner     `json:"spawner"`
	PodTemplate kubefloworgv1beta1.WorkspaceKindPodTemplate `json:"podTemplate"`
}

// WorkspaceKindUpdate represents the full WorkspaceKind spec for update operations.
type WorkspaceKindUpdate struct {
	// RevisionString is an opaque token that can be treated like an etag.
	//   - Clients receive this value from GET requests and must include it
	//     in update requests to ensure they are updating the expected version.
	//   - Clients must not parse, interpret, or compare revision values
	//     other than for equality, as the format is not guaranteed to be stable.
	Revision common.RevisionString `json:"revision"`

	Spawner     kubefloworgv1beta1.WorkspaceKindSpawner     `json:"spawner"`
	PodTemplate kubefloworgv1beta1.WorkspaceKindPodTemplate `json:"podTemplate"`
}

// Validate performs validation on the WorkspaceKindUpdate struct
// More complex validation is done by the controller when attempting to update the WorkspaceKind
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
