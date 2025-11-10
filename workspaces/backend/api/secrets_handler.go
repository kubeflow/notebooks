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
	"errors"
	"fmt"
	"net/http"

	"github.com/julienschmidt/httprouter"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/secrets"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/secrets"
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
func (a *App) GetSecretsByNamespaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)

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

	secretList, err := a.repositories.Secret.GetSecrets(r.Context(), namespace)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &SecretListEnvelope{Data: secretList}
	a.dataResponse(w, r, responseEnvelope)
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
func (a *App) GetSecretHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) { //nolint:dupl // TODO: Abstract common API patterns once implemented
	namespace := ps.ByName(NamespacePathParam)
	secretName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateKubernetesSecretName(field.NewPath(ResourceNamePathParam), secretName)...)
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
					Name:      secretName,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	secret, err := a.repositories.Secret.GetSecret(r.Context(), namespace, secretName)
	if err != nil {
		// Check if it's a not found error
		if errors.Is(err, repository.ErrSecretNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &SecretEnvelope{Data: secret}
	a.dataResponse(w, r, responseEnvelope)
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
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)

	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// Parse request body
	bodyEnvelope := &SecretCreateEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
		if a.IsMaxBytesError(err) {
			a.requestEntityTooLargeResponse(w, r, err)
			return
		}

		//
		// TODO: handle UnmarshalTypeError and return 422,
		//       decode the paths which were failed to decode (included in the error)
		//       and also do this in the other handlers which decode json
		//
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

	secretCreate := bodyEnvelope.Data

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbCreate,
			&corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      secretCreate.Name,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	secret, err := a.repositories.Secret.CreateSecret(r.Context(), namespace, secretCreate)
	if err != nil {
		if errors.Is(err, repository.ErrSecretAlreadyExists) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
			return
		}

		a.serverErrorResponse(w, r, fmt.Errorf("error creating secret: %w", err))
		return
	}

	// calculate the GET location for the created secret (for the Location header)
	location := a.LocationGetSecret(namespace, secret.Name)

	responseEnvelope := &SecretCreateEnvelope{Data: secret}
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
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateKubernetesSecretName(field.NewPath(ResourceNamePathParam), secretName)...)
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
					Name:      secretName,
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

		//
		// TODO: handle UnmarshalTypeError and return 422,
		//       decode the paths which were failed to decode (included in the error)
		//       and also do this in the other handlers which decode json
		//
		a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
		return
	}

	// validate the request body
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

	secret, err := a.repositories.Secret.UpdateSecret(r.Context(), namespace, secretName, bodyEnvelope.Data)
	if err != nil {
		if errors.Is(err, repository.ErrSecretNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error updating secret: %w", err))
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
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateKubernetesSecretName(field.NewPath(ResourceNamePathParam), secretName)...)
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
					Name:      secretName,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	err := a.repositories.Secret.DeleteSecret(r.Context(), namespace, secretName)
	if err != nil {
		if errors.Is(err, repository.ErrSecretNotFound) {
			a.notFoundResponse(w, r)
			return
		} else if apierrors.IsConflict(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error deleting secret: %w", err))
		return
	}

	a.deletedResponse(w, r)
}
