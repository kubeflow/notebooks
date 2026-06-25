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
	"encoding/base64"
	"errors"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

var ErrSecretBase64Invalid = errors.New("invalid base64 encoding in secret data")

// ApplySecretUpdateModelToSecret applies a SecretUpdate model to an existing Kubernetes Secret.
// Update semantics:
//   - key present with {"base64": "..."} → set/update the value
//   - key present with {} (Base64 is nil) → preserve the existing value from currentSecret.Data
//   - key omitted from the request → delete that key
func ApplySecretUpdateModelToSecret(secretUpdate *SecretUpdate, secret *corev1.Secret) error {
	newData := make(map[string][]byte, len(secretUpdate.Contents))
	for key, value := range secretUpdate.Contents {
		if value.Base64 != nil {
			decoded, err := base64.StdEncoding.DecodeString(*value.Base64)
			if err != nil {
				return fmt.Errorf("%w: key %q: %w", ErrSecretBase64Invalid, key, err)
			}
			newData[key] = decoded
		} else {
			// preserve existing value (key present with empty object {})
			if existingValue, ok := secret.Data[key]; ok {
				newData[key] = existingValue
			}
		}
	}

	secret.Data = newData
	secret.Type = secretUpdate.Type
	secret.Immutable = &secretUpdate.Immutable

	return nil
}

// NewSecretFromSecretCreateModel creates a Kubernetes Secret object from a SecretCreate model.
func NewSecretFromSecretCreateModel(secretCreate *SecretCreate, namespace string) (*corev1.Secret, error) {
	data := make(map[string][]byte)
	for key, value := range secretCreate.Contents {
		if value.Base64 != nil {
			decoded, err := base64.StdEncoding.DecodeString(*value.Base64)
			if err != nil {
				return nil, fmt.Errorf("%w: key %q: %w", ErrSecretBase64Invalid, key, err)
			}
			data[key] = decoded
		}
	}

	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretCreate.Name,
			Namespace: namespace,
			Labels: map[string]string{
				common.LabelCanMount:  "true",
				common.LabelCanUpdate: "true",
			},
		},
		Type:      secretCreate.Type,
		Data:      data,
		Immutable: &secretCreate.Immutable,
	}, nil
}

// secretDataFromKubernetesSecret converts Kubernetes secret.Data to SecretData.
// Returns empty SecretValue for each key to never expose actual secret values.
func secretDataFromKubernetesSecret(data map[string][]byte) SecretData {
	contents := make(SecretData)
	for key := range data {
		contents[key] = SecretValue{} // Empty value - never return actual data
	}
	return contents
}

// NewSecretCreateModelFromSecret creates a SecretCreate model from a Kubernetes Secret object.
func NewSecretCreateModelFromSecret(secret *corev1.Secret) *SecretCreate {
	return &SecretCreate{
		Name:      secret.Name,
		Type:      secret.Type,
		Immutable: ptr.Deref(secret.Immutable, false),
		Contents:  secretDataFromKubernetesSecret(secret.Data),
	}
}

// NewSecretUpdateModelFromSecret creates a SecretUpdate model from a Kubernetes Secret object.
func NewSecretUpdateModelFromSecret(secret *corev1.Secret) *SecretUpdate {
	return &SecretUpdate{
		Type:      secret.Type,
		Immutable: ptr.Deref(secret.Immutable, false),
		Contents:  secretDataFromKubernetesSecret(secret.Data),
	}
}
