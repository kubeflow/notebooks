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

package secrets

import (
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// SecretListItem represents a secret in the list response with additional metadata.
// NOTE: this is built from PartialObjectMetadata (metadata-only cache), so only ObjectMeta fields are available.
type SecretListItem struct {
	Name string `json:"name"`
	// TODO: discuss whether `type` and `immutable` should be included in the list response.
	//       these fields are NOT available from PartialObjectMetadata (metadata-only cache),
	//       so including them would require either:
	//         (a) storing them as labels/annotations on the Secret at creation time
	//         (b) making additional API calls to fetch full Secret objects
	//         (c) using a full-object cache (which defeats the purpose of metadata-only caching)
	//       see: https://github.com/kubeflow/notebooks/issues/633#issuecomment-3412745787
	// Type      string        `json:"type"`
	// Immutable bool          `json:"immutable"`
	CanUpdate bool          `json:"canUpdate"`
	CanMount  bool          `json:"canMount"`
	Mounts    []SecretMount `json:"mounts"`
	Audit     common.Audit  `json:"audit"`
}

// SecretMount represents where a secret is mounted
type SecretMount struct {
	Group string `json:"group"`
	Kind  string `json:"kind"`
	Name  string `json:"name"`
}
