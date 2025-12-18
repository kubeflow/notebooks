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

	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
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
func (r *SecretRepository) GetSecrets(ctx context.Context, namespace string) ([]models.SecretListItem, error) {
	// TODO: get actual secrets from K8s
	mockSecrets := getMockSecrets(namespace)

	secretList := make([]models.SecretListItem, len(mockSecrets))
	for i, secret := range mockSecrets {
		// TODO: will need to process all workspace objects in namespace to get mounts for each secret
		secretList[i] = models.NewSecretListItemFromSecret(secret)
	}

	return secretList, nil
}

// GetSecret returns a specific secret by name and namespace.
func (r *SecretRepository) GetSecret(ctx context.Context, namespace string, secretName string) (*models.SecretUpdate, error) {
	// TODO: get actual secret from K8s
	mockSecret := getMockSecret(namespace, secretName)
	if mockSecret == nil {
		return nil, ErrSecretNotFound
	}

	secretUpdate := models.NewSecretUpdateModelFromSecret(mockSecret)
	return &secretUpdate, nil
}

// CreateSecret creates a new secret in the specified namespace.
func (r *SecretRepository) CreateSecret(ctx context.Context, secretCreate *models.SecretCreate, namespace string) (*models.SecretCreate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"

	secret := newSecretFromSecretCreateModel(secretCreate, namespace)
	modelsCommon.UpdateObjectMetaForCreate(&secret.ObjectMeta, actor)

	// TODO: create the secret in K8s
	// ...

	createdSecret := models.NewSecretCreateModelFromSecret(secret)
	return &createdSecret, nil
}

// UpdateSecret updates an existing secret in the specified namespace.
func (r *SecretRepository) UpdateSecret(ctx context.Context, secretUpdate *models.SecretUpdate, namespace string, secretName string) (*models.SecretUpdate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"
	now := time.Now()

	// TODO: fetch the current secret from K8s
	currentSecret := getMockSecret(namespace, secretName)
	if currentSecret == nil {
		return nil, ErrSecretNotFound
	}

	secret := updateSecretFromSecretUpdateModel(secretUpdate, currentSecret)
	modelsCommon.UpdateObjectMetaForUpdate(&secret.ObjectMeta, actor, now)

	// TODO: update the secret in K8s
	// TODO: if the update fails due to a kubernetes conflict, this implies our cache is stale.
	//       we should retry the entire update operation a few times before returning a 500 error to the caller
	//       (DO NOT return a 409, as it's not the caller's fault)
	// ...

	updatedSecret := models.NewSecretUpdateModelFromSecret(secret)
	return &updatedSecret, nil
}

// DeleteSecret deletes a secret from the specified namespace.
func (r *SecretRepository) DeleteSecret(ctx context.Context, namespace string, secretName string) error {
	// TODO: get actual secret from K8s
	mockSecret := getMockSecret(namespace, secretName)
	if mockSecret == nil {
		return ErrSecretNotFound
	}

	// TODO: fail with 400 if the secret does not have LabelCanUpdate.
	//       probably make a helper function in modelsCommon for this
	// ...

	// TODO: delete the secret from K8s
	// ...

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
					modelsCommon.LabelCanUpdate: "true",
					modelsCommon.LabelCanMount:  "true",
				},
				Annotations: map[string]string{
					modelsCommon.AnnotationCreatedBy: "admin@example.com",
					modelsCommon.AnnotationUpdatedBy: "admin@example.com",
					modelsCommon.AnnotationUpdatedAt: time.Date(2024, 2, 20, 14, 45, 0, 0, time.UTC).Format(time.RFC3339),
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
					modelsCommon.LabelCanUpdate: "false",
					modelsCommon.LabelCanMount:  "true",
				},
				Annotations: map[string]string{
					modelsCommon.AnnotationCreatedBy: "devops@example.com",
					modelsCommon.AnnotationUpdatedBy: "devops@example.com",
					modelsCommon.AnnotationUpdatedAt: time.Date(2024, 1, 10, 9, 15, 0, 0, time.UTC).Format(time.RFC3339),
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
					modelsCommon.LabelCanUpdate: "false",
					modelsCommon.LabelCanMount:  "true",
				},
				Annotations: map[string]string{
					modelsCommon.AnnotationCreatedBy: "security@example.com",
					modelsCommon.AnnotationUpdatedBy: "security@example.com",
					modelsCommon.AnnotationUpdatedAt: time.Date(2024, 3, 12, 11, 30, 0, 0, time.UTC).Format(time.RFC3339),
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

// newSecretFromSecretCreateModel creates a Kubernetes Secret object from a SecretCreate model.
func newSecretFromSecretCreateModel(secretCreate *models.SecretCreate, namespace string) *corev1.Secret {
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
		},
		Type:      corev1.SecretType(secretCreate.Type),
		Data:      data,
		Immutable: &secretCreate.Immutable,
	}
}

// updateSecretFromSecretUpdateModel updates a Kubernetes Secret object using a SecretUpdate model.
func updateSecretFromSecretUpdateModel(secretUpdate *models.SecretUpdate, currentSecret *corev1.Secret) *corev1.Secret {
	newData := make(map[string][]byte, len(secretUpdate.Contents))
	for key, value := range secretUpdate.Contents {
		// TODO: this needs to handle cases where the key is not being updated (i.e., value.Base64 is nil)
		//       and retain the existing value from currentSecret.Data
		if value.Base64 != nil {
			// secretUpdate.Contents contains base64-encoded strings
			// TODO: confirm that we are encoding in the same way as Kubernetes expects (e.g. UTF-8 vs others)
			newData[key] = []byte(*value.Base64)
		}
	}

	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      currentSecret.Name,
			Namespace: currentSecret.Namespace,
			Labels: map[string]string{
				modelsCommon.LabelCanMount:  "true",
				modelsCommon.LabelCanUpdate: "true",
			},
		},
		Type:      corev1.SecretType(secretUpdate.Type),
		Data:      newData,
		Immutable: &secretUpdate.Immutable,
	}
}
