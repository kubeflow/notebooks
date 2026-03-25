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

// WorkspaceKindUpdate is used to update an existing workspace kind.
// It wraps the CRD spec directly with a revision for optimistic locking,
// keeping the update model as close to the Create model as possible.
// NOTE: we only do basic validation, more complex validation is done by the controller.
type WorkspaceKindUpdate struct {
	// Revision is an opaque token that can be treated like an etag.
	// - Clients receive this value from GET/Create requests and must include it
	//   in update requests to ensure they are updating the expected version.
	// - Clients must not parse, interpret, or compare revision values
	//   other than for equality, as the format is not guaranteed to be stable.
	Revision string `json:"revision"`

	Spec kubefloworgv1beta1.WorkspaceKindSpec `json:"spec"`
}

// Validate validates the WorkspaceKindUpdate struct.
func (w *WorkspaceKindUpdate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate revision is present
	revisionPath := prefix.Child("revision")
	if w.Revision == "" {
		errs = append(errs, field.Required(revisionPath, "revision is required"))
	}

	// NOTE: spec validation is deferred to the Kubernetes API server

	return errs
}
