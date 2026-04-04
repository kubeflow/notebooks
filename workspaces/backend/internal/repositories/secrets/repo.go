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
	"errors"
	"fmt"
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/secrets"
)

var (
	ErrSecretNotFound      = errors.New("secret not found")
	ErrSecretAlreadyExists = errors.New("secret already exists")
	ErrSecretNotCanUpdate  = fmt.Errorf("secret cannot be modified because it is not labeled with %s=true", modelsCommon.LabelCanUpdate)
)

type SecretRepository struct {
	client               client.Client // general client (secret caching disabled, direct API calls)
	secretMetadataClient client.Client // metadata-only cache client for listing secrets
}

func NewSecretRepository(cl client.Client, secretMetadataClient client.Client) *SecretRepository {
	return &SecretRepository{
		client:               cl,
		secretMetadataClient: secretMetadataClient,
	}
}

// GetSecrets returns a list of all secrets in a namespace.
// NOTE: uses a metadata-only cache for Secrets, so only ObjectMeta fields are available.
//
//	this avoids caching sensitive secret data values in memory.
func (r *SecretRepository) GetSecrets(ctx context.Context, namespace string) ([]models.SecretListItem, error) {
	// list all secret metadata in the namespace using the metadata-only cache
	secretMetaList := &metav1.PartialObjectMetadataList{}
	secretMetaList.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "",
		Version: "v1",
		Kind:    "SecretList",
	})
	if err := r.secretMetadataClient.List(ctx, secretMetaList, client.InNamespace(namespace)); err != nil {
		return nil, err
	}

	// list all workspaces in the namespace and build a map of secret name to workspaces that mount it
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList, client.InNamespace(namespace)); err != nil {
		return nil, err
	}
	secretToMountsList := buildSecretMountMap(workspaceList)

	// convert secret metadata to models
	secretModels := make([]models.SecretListItem, len(secretMetaList.Items))
	for i := range secretMetaList.Items {
		secret := &secretMetaList.Items[i]
		secretModels[i] = models.NewSecretListItemFromSecretMetadata(secret, secretToMountsList)
	}

	return secretModels, nil
}

// buildSecretMountMap builds a map from secret name to workspaces that mount it from a list of workspaces.
func buildSecretMountMap(workspaceList *kubefloworgv1beta1.WorkspaceList) map[string][]models.SecretMount {
	secretToMounts := make(map[string][]models.SecretMount)
	for i := range workspaceList.Items {
		ws := workspaceList.Items[i]
		mount := models.SecretMount{
			Group: kubefloworgv1beta1.GroupVersion.Group,
			Kind:  "Workspace",
			Name:  ws.Name,
		}

		// a Workspace may mount the same secret multiple times, but we only want to include it once for each secret
		seenSecrets := make(map[string]bool)

		for _, secretVolume := range ws.Spec.PodTemplate.Volumes.Secrets {
			secretName := secretVolume.SecretName
			if !seenSecrets[secretName] {
				secretToMounts[secretName] = append(secretToMounts[secretName], mount)
				seenSecrets[secretName] = true
			}
		}
	}
	return secretToMounts
}

// GetSecret returns a specific secret by name and namespace.
func (r *SecretRepository) GetSecret(ctx context.Context, namespace string, secretName string) (*models.SecretUpdate, error) {
	secret := &corev1.Secret{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: secretName}, secret); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrSecretNotFound
		}
		return nil, err
	}

	secretUpdate := models.NewSecretUpdateModelFromSecret(secret)
	return &secretUpdate, nil
}

// CreateSecret creates a new secret in the specified namespace.
func (r *SecretRepository) CreateSecret(ctx context.Context, secretCreate *models.SecretCreate, namespace string) (*models.SecretCreate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"

	secret := newSecretFromSecretCreateModel(secretCreate, namespace)
	modelsCommon.UpdateObjectMetaForCreate(&secret.ObjectMeta, actor)

	// create the secret in K8s
	if err := r.client.Create(ctx, secret); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, ErrSecretAlreadyExists
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
	}

	createdSecret := models.NewSecretCreateModelFromSecret(secret)
	return &createdSecret, nil
}

// UpdateSecret updates an existing secret in the specified namespace.
func (r *SecretRepository) UpdateSecret(ctx context.Context, secretUpdate *models.SecretUpdate, namespace string, secretName string) (*models.SecretUpdate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"
	now := time.Now()

	// fetch the current secret from K8s
	currentSecret := &corev1.Secret{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: secretName}, currentSecret); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrSecretNotFound
		}
		return nil, err
	}

	// check if the secret has the can-update label
	if currentSecret.Labels[modelsCommon.LabelCanUpdate] != "true" {
		return nil, ErrSecretNotCanUpdate
	}

	// apply the update model to the current secret
	secret := applySecretUpdateModel(secretUpdate, currentSecret)
	modelsCommon.UpdateObjectMetaForUpdate(&secret.ObjectMeta, actor, now)

	// update the secret in K8s
	if err := r.client.Update(ctx, secret); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrSecretNotFound
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		// NOTE: if the update fails due to a kubernetes conflict, this implies our cache is stale.
		//       we return a 500 error to the caller (not a 409), as it's not the caller's fault.
		return nil, fmt.Errorf("failed to update secret: %w", err)
	}

	updatedSecret := models.NewSecretUpdateModelFromSecret(secret)
	return &updatedSecret, nil
}

// DeleteSecret deletes a secret from the specified namespace.
func (r *SecretRepository) DeleteSecret(ctx context.Context, namespace string, secretName string) error {
	// get the current secret from K8s
	secret := &corev1.Secret{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: secretName}, secret); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrSecretNotFound
		}
		return err
	}

	// check if the secret has the can-update label
	if secret.Labels[modelsCommon.LabelCanUpdate] != "true" {
		return ErrSecretNotCanUpdate
	}

	// delete the secret from K8s
	if err := r.client.Delete(ctx, secret); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrSecretNotFound
		}
		return err
	}

	return nil
}

// newSecretFromSecretCreateModel creates a Kubernetes Secret object from a SecretCreate model.
func newSecretFromSecretCreateModel(secretCreate *models.SecretCreate, namespace string) *corev1.Secret {
	// convert SecretValue back to []byte for Kubernetes
	data := make(map[string][]byte)
	for key, value := range secretCreate.Contents {
		if value.Base64 != nil {
			data[key] = []byte(*value.Base64)
		}
	}

	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretCreate.Name,
			Namespace: namespace,
			Labels: map[string]string{
				modelsCommon.LabelCanMount:  "true",
				modelsCommon.LabelCanUpdate: "true",
			},
		},
		Type:      corev1.SecretType(secretCreate.Type),
		Data:      data,
		Immutable: &secretCreate.Immutable,
	}
}

// applySecretUpdateModel applies a SecretUpdate model to an existing Kubernetes Secret.
// Update semantics:
//   - key present with {"base64": "..."} → set/update the value
//   - key present with {} (Base64 is nil) → preserve the existing value from currentSecret.Data
//   - key omitted from the request → delete that key
func applySecretUpdateModel(secretUpdate *models.SecretUpdate, currentSecret *corev1.Secret) *corev1.Secret {
	newData := make(map[string][]byte, len(secretUpdate.Contents))
	for key, value := range secretUpdate.Contents {
		if value.Base64 != nil {
			// explicit new value provided
			newData[key] = []byte(*value.Base64)
		} else {
			// preserve existing value (key present with empty object {})
			if existingValue, ok := currentSecret.Data[key]; ok {
				newData[key] = existingValue
			}
		}
	}

	// use DeepCopy to preserve ResourceVersion, existing labels, annotations, etc.
	secret := currentSecret.DeepCopy()
	secret.Data = newData
	secret.Type = corev1.SecretType(secretUpdate.Type)
	secret.Immutable = &secretUpdate.Immutable

	return secret
}
