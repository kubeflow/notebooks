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
)

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
func NewSecretCreateModelFromSecret(secret *corev1.Secret) SecretCreate {
	contents := secretDataFromKubernetesSecret(secret.Data)

	return SecretCreate{
		Name: secret.Name,
		secretBase: secretBase{
			Type:      string(secret.Type),
			Immutable: ptr.Deref(secret.Immutable, false),
			Contents:  contents,
		},
	}
}

// NewSecretUpdateModelFromSecret creates a SecretUpdate model from a Kubernetes Secret object.
func NewSecretUpdateModelFromSecret(secret *corev1.Secret) SecretUpdate {
	contents := secretDataFromKubernetesSecret(secret.Data)

	return SecretUpdate{
		secretBase: secretBase{
			Type:      string(secret.Type),
			Immutable: ptr.Deref(secret.Immutable, false),
			Contents:  contents,
		},
	}
}
