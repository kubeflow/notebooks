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
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// NewSecretListItemFromSecret creates a new SecretListItem model from a Kubernetes Secret object.
// TODO: Extract mounts from workspace references (would need to query workspaces) and pass in as an argument.
func NewSecretListItemFromSecret(secret *corev1.Secret) SecretListItem {
	// Convert the secret data to the API format (never return actual values)
	contents := make(SecretData)
	for key := range secret.Data {
		contents[key] = SecretValue{} // Empty value - never return actual data
	}

	// Extract audit information from annotations
	audit := common.NewAuditFromObjectMeta(&secret.ObjectMeta)

	// Check labels for permissions
	canUpdate := secret.Labels[common.LabelCanUpdate] == "true"
	canMount := secret.Labels[common.LabelCanMount] == "true"

	// TODO: Extract mounts from workspace references (would need to query workspaces)
	mounts := []SecretMount{}

	return SecretListItem{
		Name:      secret.Name,
		Type:      string(secret.Type),
		Immutable: ptr.Deref(secret.Immutable, false),
		CanUpdate: canUpdate,
		CanMount:  canMount,
		Mounts:    mounts,
		Audit:     audit,
	}
}
