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

package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/julienschmidt/httprouter"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/secrets"
)

type SecretEnvelope Envelope[*models.SecretUpdate]
type SecretListEnvelope Envelope[[]models.SecretListItem]
type SecretCreateEnvelope Envelope[*models.SecretCreate]

// GetSecretsHandler returns a list of all secrets in a namespace.
//
//	@Summary		Returns a list of all secrets in a namespace
//	@Description	Provides a list of all secrets that the user has access to in the specified namespace
//	@Tags			secrets
//	@ID				listSecrets
//	@Produce		application/json
//	@Param			namespace	path		string				true	"Namespace name"	extensions(x-example=my-namespace)
//	@Success		200			{object}	SecretListEnvelope	"Successful secrets response"
//	@Failure		401			{object}	ErrorEnvelope		"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope		"Forbidden"
//	@Failure		422			{object}	ErrorEnvelope		"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope		"Internal server error"
//	@Router			/secrets/{namespace} [get]
func (a *App) GetSecretsHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)

	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	// TODO: Replace with actual repository call when implemented
	// For now, return dummy data as stub
	secretList := getMockSecrets()
	responseEnvelope := &SecretListEnvelope{Data: secretList}
	a.dataResponse(w, r, responseEnvelope)
}

// getMockSecrets returns temporary mock data for frontend development
// TODO: Remove this function when actual repository implementation is ready
func getMockSecrets() []models.SecretListItem {
	return []models.SecretListItem{
		{
			Name:      "database-credentials",
			Type:      "Opaque",
			Immutable: false,
			CanUpdate: true,
			CanMount:  true,
			Mounts: []models.SecretMount{
				{Group: "apps", Kind: "Deployment", Name: "web-app"},
				{Group: "apps", Kind: "Deployment", Name: "api-server"},
			},
			Audit: common.Audit{
				CreatedAt: time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC),
				CreatedBy: "admin@example.com",
				UpdatedAt: time.Date(2024, 2, 20, 14, 45, 0, 0, time.UTC),
				UpdatedBy: "admin@example.com",
			},
		},
		{
			Name:      "api-key-secret",
			Type:      "Opaque",
			Immutable: true,
			CanUpdate: false,
			CanMount:  true,
			Mounts: []models.SecretMount{
				{Group: "apps", Kind: "Deployment", Name: "external-api-client"},
			},
			Audit: common.Audit{
				CreatedAt: time.Date(2024, 1, 10, 9, 15, 0, 0, time.UTC),
				CreatedBy: "devops@example.com",
				UpdatedAt: time.Date(2024, 1, 10, 9, 15, 0, 0, time.UTC),
				UpdatedBy: "devops@example.com",
			},
		},
		{
			Name:      "tls-certificate",
			Type:      "kubernetes.io/tls",
			Immutable: false,
			CanUpdate: false,
			CanMount:  true,
			Mounts: []models.SecretMount{
				{Group: "networking.k8s.io", Kind: "Ingress", Name: "web-ingress"},
			},
			Audit: common.Audit{
				CreatedAt: time.Date(2024, 3, 5, 16, 20, 0, 0, time.UTC),
				CreatedBy: "security@example.com",
				UpdatedAt: time.Date(2024, 3, 12, 11, 30, 0, 0, time.UTC),
				UpdatedBy: "security@example.com",
			},
		},
	}
}

// GetSecretHandler returns a specific secret by name and namespace.
//
//	@Summary		Returns a specific secret
//	@Description	Provides details of a specific secret by name and namespace
//	@Tags			secrets
//	@ID				getSecret
//	@Produce		application/json
//	@Param			namespace	path		string			true	"Namespace name"
//	@Param			name		path		string			true	"Secret name"	extensions(x-example=my-secret)
//	@Success		200			{object}	SecretEnvelope	"Successful secret response"
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden"
//	@Failure		404			{object}	ErrorEnvelope	"Secret not found"
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error"
//	@Router			/secrets/{namespace}/{name} [get]
func (a *App) GetSecretHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	secretName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), secretName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbGet,
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	// TODO: Replace with actual repository call when implemented
	// For now, return mock data as stub
	secret := getMockSecret(secretName)
	if secret == nil {
		a.notFoundResponse(w, r)
		return
	}
	responseEnvelope := &SecretEnvelope{Data: secret}
	a.dataResponse(w, r, responseEnvelope)
}

// getMockSecret returns temporary mock data for a specific secret by name
// TODO: Remove this function when actual repository implementation is ready
func getMockSecret(secretName string) *models.SecretUpdate {
	switch secretName {
	case "database-credentials":
		return &models.SecretUpdate{
			SecretBase: models.SecretBase{
				Type:      "Opaque",
				Immutable: false,
				Contents: models.SecretData{
					"username": models.SecretValue{},
					"password": models.SecretValue{},
					"host":     models.SecretValue{},
					"port":     models.SecretValue{},
				},
			},
		}
	case "api-key-secret":
		return &models.SecretUpdate{
			SecretBase: models.SecretBase{
				Type:      "Opaque",
				Immutable: true,
				Contents: models.SecretData{
					"api-key":    models.SecretValue{},
					"api-secret": models.SecretValue{},
				},
			},
		}
	case "tls-certificate":
		return &models.SecretUpdate{
			SecretBase: models.SecretBase{
				Type:      "kubernetes.io/tls",
				Immutable: false,
				Contents: models.SecretData{
					"tls.crt": models.SecretValue{},
					"tls.key": models.SecretValue{},
				},
			},
		}
	default:
		return nil // Return nil for unknown secret names to trigger 404
	}
}

// createMockSecretFromRequest returns temporary mock data based on the create request
// TODO: Remove this function when actual repository implementation is ready
func createMockSecretFromRequest(secretCreate *models.SecretCreate) *models.SecretCreate {
	// Create empty contents to never expose actual secret values
	contents := make(models.SecretData)
	for key := range secretCreate.Contents {
		contents[key] = models.SecretValue{} // Empty value - never return actual data
	}

	// Use the request data to create a mock response
	// This simulates what would happen after creating the secret
	return &models.SecretCreate{
		Name: secretCreate.Name,
		SecretBase: models.SecretBase{
			Type:      secretCreate.Type,
			Immutable: secretCreate.Immutable,
			Contents:  contents,
		},
	}
}

// updateMockSecretFromRequest returns temporary mock data based on the update request
// TODO: Remove this function when actual repository implementation is ready
func updateMockSecretFromRequest(secretName string, secretUpdate *models.SecretUpdate) *models.SecretUpdate {
	// Check if the secret exists in our mock data
	switch secretName {
	case "database-credentials", "api-key-secret", "tls-certificate":

		// Create empty contents to never expose actual secret values
		contents := make(models.SecretData)
		for key := range secretUpdate.Contents {
			contents[key] = models.SecretValue{} // Empty value - never return actual data
		}

		// Return the updated secret data (simulating successful update)
		return &models.SecretUpdate{
			SecretBase: models.SecretBase{
				Type:      secretUpdate.Type,
				Immutable: secretUpdate.Immutable,
				Contents:  contents,
			},
		}
	default:
		// Return nil for unknown secret names to trigger 404
		return nil
	}
}

// CreateSecretHandler creates a new secret.
//
//	@Summary		Creates a new secret
//	@Description	Creates a new secret in the specified namespace
//	@Tags			secrets
//	@ID				createSecret
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string					true	"Namespace name"
//	@Param			secret		body		SecretCreateEnvelope	true	"Secret creation request"
//	@Success		201			{object}	SecretCreateEnvelope	"Secret created successfully"
//	@Failure		400			{object}	ErrorEnvelope			"Bad request"
//	@Failure		401			{object}	ErrorEnvelope			"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope			"Forbidden"
//	@Failure		409			{object}	ErrorEnvelope			"Secret already exists"
//	@Failure		413			{object}	ErrorEnvelope			"Request Entity Too Large. The request body is too large."
//	@Failure		415			{object}	ErrorEnvelope			"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422			{object}	ErrorEnvelope			"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope			"Internal server error"
//	@Router			/secrets/{namespace} [post]
func (a *App) CreateSecretHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)

	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbCreate,
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	// Parse request body
	bodyEnvelope := &SecretCreateEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
		if a.IsMaxBytesError(err) {
			a.requestEntityTooLargeResponse(w, r, err)
			return
		}
		a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
		return
	}

	// Validate the request body
	dataPath := field.NewPath("data")
	if bodyEnvelope.Data == nil {
		valErrs := field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = bodyEnvelope.Data.Validate(dataPath)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// TODO: Replace with actual repository call when implemented
	// For now, return mock data as stub
	secret := createMockSecretFromRequest(bodyEnvelope.Data)
	responseEnvelope := &SecretCreateEnvelope{Data: secret}
	location := fmt.Sprintf("/secrets/%s/%s", namespace, bodyEnvelope.Data.Name)
	a.createdResponse(w, r, responseEnvelope, location)
}

// UpdateSecretHandler updates an existing secret.
//
//	@Summary		Updates an existing secret
//	@Description	Updates an existing secret in the specified namespace
//	@Tags			secrets
//	@ID				updateSecret
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string				true	"Namespace name"
//	@Param			name		path		string				true	"Secret name"
//	@Param			secret		body		models.SecretUpdate	true	"Secret update request"
//	@Success		200			{object}	SecretEnvelope		"Secret updated successfully"
//	@Failure		400			{object}	ErrorEnvelope		"Bad request"
//	@Failure		401			{object}	ErrorEnvelope		"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope		"Forbidden"
//	@Failure		404			{object}	ErrorEnvelope		"Secret not found"
//	@Failure		413			{object}	ErrorEnvelope		"Request Entity Too Large. The request body is too large."
//	@Failure		415			{object}	ErrorEnvelope		"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422			{object}	ErrorEnvelope		"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope		"Internal server error"
//	@Router			/secrets/{namespace}/{name} [put]
func (a *App) UpdateSecretHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	secretName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), secretName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbUpdate,
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	// Parse request body
	bodyEnvelope := &SecretEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
		if a.IsMaxBytesError(err) {
			a.requestEntityTooLargeResponse(w, r, err)
			return
		}
		a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
		return
	}

	// Validate the request body
	dataPath := field.NewPath("data")
	if bodyEnvelope.Data == nil {
		valErrs := field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = bodyEnvelope.Data.Validate(dataPath)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// TODO: Replace with actual repository call when implemented
	// For now, return mock data as stub
	secret := updateMockSecretFromRequest(secretName, bodyEnvelope.Data)
	if secret == nil {
		a.notFoundResponse(w, r)
		return
	}
	responseEnvelope := &SecretEnvelope{Data: secret}
	a.dataResponse(w, r, responseEnvelope)
}

// DeleteSecretHandler deletes a secret.
//
//	@Summary		Deletes a secret
//	@Description	Deletes a secret from the specified namespace
//	@Tags			secrets
//	@ID				deleteSecret
//	@Accept			json
//	@Param			namespace	path	string	true	"Namespace name"	extensions(x-example=my-namespace)
//	@Param			name		path	string	true	"Secret name"		extensions(x-example=my-secret)
//	@Success		204			"No Content"
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden"
//	@Failure		404			{object}	ErrorEnvelope	"Secret not found"
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error"
//	@Router			/secrets/{namespace}/{name} [delete]
func (a *App) DeleteSecretHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	secretName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), secretName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbDelete,
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	// TODO: Replace with actual repository call when implemented
	// For now, always return 204 No Content as stub
	a.deletedResponse(w, r)
}
