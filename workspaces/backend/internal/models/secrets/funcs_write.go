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
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// ToKubernetesSecret converts a SecretCreate model to a Kubernetes Secret object.
func (s *SecretCreate) ToKubernetesSecret(namespace string, userEmail string) *corev1.Secret {
	// Convert SecretValue back to []byte for Kubernetes
	data := make(map[string][]byte)
	for key, value := range s.Contents {
		if value.Base64 != nil {
			// Store base64-encoded string as []byte (Kubernetes expects base64-encoded data)
			// Empty string is a valid value, so we include it
			data[key] = []byte(*value.Base64)
		}
	}

	now := time.Now().Format(time.RFC3339)

	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      s.Name,
			Namespace: namespace,
			Labels: map[string]string{
				"notebooks.kubeflow.org/can-mount":  "true",
				"notebooks.kubeflow.org/can-update": "true",
			},
			Annotations: map[string]string{
				"notebooks.kubeflow.org/created-by": userEmail,
				"notebooks.kubeflow.org/created-at": now,
				"notebooks.kubeflow.org/updated-by": userEmail,
				"notebooks.kubeflow.org/updated-at": now,
			},
		},
		Type:      corev1.SecretType(s.Type),
		Data:      data,
		Immutable: &s.Immutable,
	}
}

// ToKubernetesSecret converts a SecretUpdate model to a Kubernetes Secret object.
// TODO: implement logic to merge SecretUpdate with currentSecret.
func (s *SecretUpdate) ToKubernetesSecret(currentSecret *corev1.Secret, userEmail string) *corev1.Secret {
	// Convert SecretValue back to []byte for Kubernetes
	data := make(map[string][]byte)
	for key, value := range s.Contents {
		if value.Base64 != nil {
			// Store base64-encoded string as []byte (Kubernetes expects base64-encoded data)
			// Empty string is a valid value, so we include it
			data[key] = []byte(*value.Base64)
		}
	}

	now := time.Now().Format(time.RFC3339)

	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      currentSecret.Name,
			Namespace: currentSecret.Namespace,
			Labels: map[string]string{
				"notebooks.kubeflow.org/can-mount":  "true",
				"notebooks.kubeflow.org/can-update": "true",
			},
			Annotations: map[string]string{
				"notebooks.kubeflow.org/created-by": currentSecret.Annotations["notebooks.kubeflow.org/created-by"],
				"notebooks.kubeflow.org/created-at": currentSecret.Annotations["notebooks.kubeflow.org/created-at"],
				"notebooks.kubeflow.org/updated-by": userEmail,
				"notebooks.kubeflow.org/updated-at": now,
			},
		},
		Type:      corev1.SecretType(s.Type),
		Data:      data,
		Immutable: &s.Immutable,
	}
}
