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
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	common_models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/secrets"
)

var (
	ErrSecretNotFound      = fmt.Errorf("secret not found")
	ErrSecretAlreadyExists = fmt.Errorf("secret already exists")
)

type SecretRepository struct {
	client client.Client
}

func NewSecretRepository(cl client.Client) *SecretRepository {
	return &SecretRepository{
		client: cl,
	}
}

// GetSecrets returns a list of all secrets in a namespace.
// TODO: Implement actual K8s control plane interaction
func (r *SecretRepository) GetSecrets(ctx context.Context, namespace string) ([]models.SecretListItem, error) {
	// Get mock secrets as K8s Secret objects
	mockSecrets := getMockSecrets(namespace)

	// Convert to API models
	secretList := make([]models.SecretListItem, len(mockSecrets))
	for i, secret := range mockSecrets {
		// TODO: will need to process all workspace objects in namespace to get mounts for each secret
		secretList[i] = models.NewSecretListItemFromSecret(secret)
	}

	return secretList, nil
}

// GetSecret returns a specific secret by name and namespace.
// TODO: Implement actual K8s control plane interaction
func (r *SecretRepository) GetSecret(ctx context.Context, namespace string, secretName string) (*models.SecretUpdate, error) {
	// Get mock secret as K8s Secret object
	mockSecret := getMockSecret(namespace, secretName)
	if mockSecret == nil {
		return nil, ErrSecretNotFound
	}

	// Convert to API model
	secretUpdate := models.NewSecretUpdateModelFromSecret(mockSecret)
	return &secretUpdate, nil
}

// CreateSecret creates a new secret in the specified namespace.
// TODO: Implement actual K8s control plane interaction
func (r *SecretRepository) CreateSecret(ctx context.Context, namespace string, secretCreate *models.SecretCreate) (*models.SecretCreate, error) {
	// Convert to K8s Secret object (using empty user email for mock)
	// TODO: Get actual user email from context when implementing real K8s interaction
	userEmail := "mock@example.com"
	k8sSecret := secretCreateModelToKubernetesSecret(secretCreate, namespace, userEmail)

	// For now, just simulate creating the secret by converting back to model
	// TODO: Actually create the secret in K8s
	createdSecret := models.NewSecretCreateModelFromSecret(k8sSecret)
	return &createdSecret, nil
}

// UpdateSecret updates an existing secret in the specified namespace.
// TODO: Implement actual K8s control plane interaction
func (r *SecretRepository) UpdateSecret(ctx context.Context, namespace string, secretName string, secretUpdate *models.SecretUpdate) (*models.SecretUpdate, error) {
	// Get existing mock secret to simulate update
	currentSecret := getMockSecret(namespace, secretName)
	if currentSecret == nil {
		return nil, ErrSecretNotFound
	}

	// Convert to K8s Secret object (using empty user email for mock)
	// TODO: Get actual user email from context when implementing real K8s interaction
	userEmail := "mock@example.com"
	k8sSecret := secretUpdateModelToKubernetesSecret(secretUpdate, currentSecret, userEmail)

	// For now, just simulate updating the secret by converting back to model
	// TODO: Actually update the secret in K8s
	updatedSecret := models.NewSecretUpdateModelFromSecret(k8sSecret)
	return &updatedSecret, nil
}

// DeleteSecret deletes a secret from the specified namespace.
// TODO: Implement actual K8s control plane interaction
func (r *SecretRepository) DeleteSecret(ctx context.Context, namespace string, secretName string) error {
	// Check if secret exists in mock data
	mockSecret := getMockSecret(namespace, secretName)
	if mockSecret == nil {
		return ErrSecretNotFound
	}

	// TODO: Actually delete the secret in K8s
	return nil
}

// getMockSecrets returns temporary mock data as K8s Secret objects for frontend development
// TODO: Remove this function when actual repository implementation is ready
func getMockSecrets(namespace string) []*corev1.Secret {
	return []*corev1.Secret{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "database-credentials",
				Namespace: namespace,
				Labels: map[string]string{
					common_models.LabelCanUpdate: "true",
					common_models.LabelCanMount:  "true",
				},
				Annotations: map[string]string{
					common_models.AnnotationCreatedBy: "admin@example.com",
					common_models.AnnotationUpdatedBy: "admin@example.com",
					common_models.AnnotationUpdatedAt: time.Date(2024, 2, 20, 14, 45, 0, 0, time.UTC).Format(time.RFC3339),
				},
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{
				"username": []byte("dummy"),
				"password": []byte("dummy"),
				"host":     []byte("dummy"),
				"port":     []byte("dummy"),
			},
			Immutable: ptr.To(false),
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "api-key-secret",
				Namespace: namespace,
				Labels: map[string]string{
					common_models.LabelCanUpdate: "false",
					common_models.LabelCanMount:  "true",
				},
				Annotations: map[string]string{
					common_models.AnnotationCreatedBy: "devops@example.com",
					common_models.AnnotationUpdatedBy: "devops@example.com",
					common_models.AnnotationUpdatedAt: time.Date(2024, 1, 10, 9, 15, 0, 0, time.UTC).Format(time.RFC3339),
				},
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{
				"api-key":    []byte("dummy"),
				"api-secret": []byte("dummy"),
			},
			Immutable: ptr.To(true),
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "tls-certificate",
				Namespace: namespace,
				Labels: map[string]string{
					common_models.LabelCanUpdate: "false",
					common_models.LabelCanMount:  "true",
				},
				Annotations: map[string]string{
					common_models.AnnotationCreatedBy: "security@example.com",
					common_models.AnnotationUpdatedBy: "security@example.com",
					common_models.AnnotationUpdatedAt: time.Date(2024, 3, 12, 11, 30, 0, 0, time.UTC).Format(time.RFC3339),
				},
			},
			Type: corev1.SecretTypeTLS,
			Data: map[string][]byte{
				"tls.crt": []byte("dummy"),
				"tls.key": []byte("dummy"),
			},
			Immutable: ptr.To(false),
		},
	}
}

// getMockSecret returns temporary mock data as a K8s Secret object for a specific secret by name
// TODO: Remove this function when actual repository implementation is ready
func getMockSecret(namespace string, secretName string) *corev1.Secret {
	mockSecrets := getMockSecrets(namespace)
	for _, secret := range mockSecrets {
		if secret.Name == secretName {
			return secret
		}
	}
	return nil // Return nil for unknown secret names to trigger 404
}

// secretCreateModelToKubernetesSecret converts a SecretCreate model to a Kubernetes Secret object.
func secretCreateModelToKubernetesSecret(secretCreate *models.SecretCreate, namespace string, userEmail string) *corev1.Secret {
	// Convert SecretValue back to []byte for Kubernetes
	data := make(map[string][]byte)
	for key, value := range secretCreate.Contents {
		if value.Base64 != nil {
			// Store base64-encoded string as []byte (Kubernetes expects base64-encoded data)
			// Empty string is a valid value, so we include it
			data[key] = []byte(*value.Base64)
		}
	}

	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretCreate.Name,
			Namespace: namespace,
			Labels: map[string]string{
				common_models.LabelCanMount:  "true",
				common_models.LabelCanUpdate: "true",
			},
			Annotations: map[string]string{
				common_models.AnnotationCreatedBy: userEmail,
			},
		},
		Type:      corev1.SecretType(secretCreate.Type),
		Data:      data,
		Immutable: &secretCreate.Immutable,
	}
}

// secretUpdateModelToKubernetesSecret converts a SecretUpdate model to a Kubernetes Secret object.
// TODO: implement logic to merge SecretUpdate with currentSecret.
func secretUpdateModelToKubernetesSecret(secretUpdate *models.SecretUpdate, currentSecret *corev1.Secret, userEmail string) *corev1.Secret {
	// Convert SecretValue back to []byte for Kubernetes
	data := make(map[string][]byte)
	for key, value := range secretUpdate.Contents {
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
				common_models.LabelCanMount:  "true",
				common_models.LabelCanUpdate: "true",
			},
			Annotations: map[string]string{
				common_models.AnnotationUpdatedBy: userEmail,
				common_models.AnnotationUpdatedAt: now,
			},
		},
		Type:      corev1.SecretType(secretUpdate.Type),
		Data:      data,
		Immutable: &secretUpdate.Immutable,
	}
}
