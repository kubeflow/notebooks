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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// NewSecretListItemFromSecretMetadata creates a new SecretListItem model from a PartialObjectMetadata object.
// NOTE: because we use a metadata-only cache for Secrets, we only have access to ObjectMeta fields.
//
//	fields like Type and Immutable are NOT available from PartialObjectMetadata.
func NewSecretListItemFromSecretMetadata(secret *metav1.PartialObjectMetadata, secretToMountsList map[string][]SecretMount) SecretListItem {
	// extract audit information from annotations
	audit := common.NewAuditFromObjectMeta(&secret.ObjectMeta)

	// check labels for permissions
	canUpdate := secret.Labels[common.LabelCanUpdate] == "true"
	canMount := secret.Labels[common.LabelCanMount] == "true"

	// get mounts from the pre-built map
	mounts := secretToMountsList[secret.Name]
	if mounts == nil {
		mounts = []SecretMount{}
	}

	return SecretListItem{
		Name:      secret.Name,
		CanUpdate: canUpdate,
		CanMount:  canMount,
		Mounts:    mounts,
		Audit:     audit,
	}
}
