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
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

// CalculateWorkspaceKindRevision calculates the revision/etag for a workspace kind.
// FORMAT: hex(sha256("<WSK_UUID>:<WSK_NAME>:<WSK_GENERATION>"))
// this detects changes to the `spec` of the workspace kind, while also ensuring
// that the resource itself is the same (via UID and name).
func CalculateWorkspaceKindRevision(wsk *kubefloworgv1beta1.WorkspaceKind) string {
	revisionInput := fmt.Sprintf("%s:%s:%d", wsk.UID, wsk.Name, wsk.Generation)
	hash := sha256.Sum256([]byte(revisionInput))
	return hex.EncodeToString(hash[:])
}

// NewWorkspaceKindUpdateModelFromWorkspaceKind creates a WorkspaceKindUpdate model from a WorkspaceKind object.
// Used by GET single and Create responses.
func NewWorkspaceKindUpdateModelFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind) *WorkspaceKindUpdate {
	return &WorkspaceKindUpdate{
		Revision:    CalculateWorkspaceKindRevision(wsk),
		Spawner:     wsk.Spec.Spawner,
		PodTemplate: wsk.Spec.PodTemplate,
	}
}

// ApplyWorkspaceKindUpdateModelToWorkspaceKind applies the update model to the WorkspaceKind object.
// All validation is deferred to the Kubernetes API server and controller webhooks.
func ApplyWorkspaceKindUpdateModelToWorkspaceKind(update *WorkspaceKindUpdate, wsk *kubefloworgv1beta1.WorkspaceKind) {
	wsk.Spec.Spawner = update.Spawner
	wsk.Spec.PodTemplate = update.PodTemplate
}
