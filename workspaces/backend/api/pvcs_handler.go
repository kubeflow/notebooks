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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/pvcs"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/pvcs"
)

type PVCListEnvelope Envelope[[]models.PVCListItem]
type PVCCreateEnvelope Envelope[*models.PVCCreate]

// GetPVCsByNamespaceHandler returns a list of persistent volume claims in a specific namespace.
//
//	@Summary		List persistent volume claims by namespace
//	@Description	Returns a list of persistent volume claims in a specific namespace.
//	@Tags			persistentvolumeclaims
//	@ID				listPVCs
//	@Produce		application/json
//	@Param			namespace	path		string			true	"Namespace name"	extensions(x-example=my-namespace)
//	@Success		200			{object}	PVCListEnvelope	"Successful PVCs response"
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden"
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error"
//	@Router			/persistentvolumeclaims/{namespace} [get]
func (a *App) GetPVCsByNamespaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) { //nolint:dupl
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbList, auth.PersistentVolumeClaims, auth.ResourcePolicyResourceMeta{Namespace: namespace}),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	pvcs, err := a.repositories.PVC.GetPVCs(r.Context(), namespace)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &PVCListEnvelope{Data: pvcs}
	a.dataResponse(w, r, responseEnvelope)
}

// CreatePVCHandler creates a new persistent volume claim in the specified namespace.
//
//	@Summary		Create persistent volume claim
//	@Description	Creates a new persistent volume claim in the specified namespace.
//	@Tags			persistentvolumeclaims
//	@ID				createPVC
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string				true	"Namespace name"
//	@Param			pvc			body		PVCCreateEnvelope	true	"PVC creation request"
//	@Success		201			{object}	PVCCreateEnvelope	"PVC created successfully"
//	@Failure		400			{object}	ErrorEnvelope		"Bad request"
//	@Failure		401			{object}	ErrorEnvelope		"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope		"Forbidden"
//	@Failure		409			{object}	ErrorEnvelope		"PVC already exists"
//	@Failure		413			{object}	ErrorEnvelope		"Request Entity Too Large. The request body is too large."
//	@Failure		415			{object}	ErrorEnvelope		"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422			{object}	ErrorEnvelope		"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope		"Internal server error"
//	@Router			/persistentvolumeclaims/{namespace} [post]
func (a *App) CreatePVCHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// validate the Content-Type header
	if success := a.ValidateContentType(w, r, MediaTypeJson); !success {
		return
	}

	// decode the request body
	bodyEnvelope := &PVCCreateEnvelope{}
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
		valErrs = field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = bodyEnvelope.Data.Validate(dataPath)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// give the request data a clear name
	pvcCreate := bodyEnvelope.Data

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbCreate, auth.PersistentVolumeClaims, auth.ResourcePolicyResourceMeta{Namespace: namespace, Name: pvcCreate.Name}),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	createdPVC, err := a.repositories.PVC.CreatePVC(r.Context(), pvcCreate, namespace)
	if err != nil {
		if helper.IsInternalValidationError(err) {
			fieldErrs := helper.FieldErrorsFromInternalValidationError(err)
			a.failedValidationResponse(w, r, errMsgInternalValidation, fieldErrs, nil)
			return
		}
		if errors.Is(err, repository.ErrPVCAlreadyExists) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
			return
		}
		if apierrors.IsInvalid(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.failedValidationResponse(w, r, errMsgKubernetesValidation, nil, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error creating PVC: %w", err))
		return
	}

	// calculate the GET location for the created PVC (for the Location header)
	// TODO: create a helper LocationGetPVC and call it here when a GET PVC by name endpoint is implemented
	location := ""

	responseEnvelope := &PVCCreateEnvelope{Data: createdPVC}
	a.createdResponse(w, r, responseEnvelope, location)
}

// DeletePVCHandler deletes a specific persistent volume claim by namespace and name.
//
//	@Summary		Deletes a persistent volume claim
//	@Description	Deletes a specific persistent volume claim identified by namespace and name.
//	@Tags			persistentvolumeclaims
//	@ID				deletePVC
//	@Param			namespace	path	string	true	"Namespace name"	extensions(x-example=my-namespace)
//	@Param			name		path	string	true	"PVC name"			extensions(x-example=my-pvc)
//	@Success		204			"No Content"
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden"
//	@Failure		404			{object}	ErrorEnvelope	"PVC not found"
//	@Failure		409			{object}	ErrorEnvelope	"Conflict"
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error"
//	@Router			/persistentvolumeclaims/{namespace}/{name} [delete]
func (a *App) DeletePVCHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	pvcName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateKubernetesPVCName(field.NewPath(ResourceNamePathParam), pvcName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbDelete, auth.PersistentVolumeClaims, auth.ResourcePolicyResourceMeta{Namespace: namespace, Name: pvcName}),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	err := a.repositories.PVC.DeletePVC(r.Context(), namespace, pvcName)
	if err != nil {
		if errors.Is(err, repository.ErrPVCNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		if errors.Is(err, repository.ErrPVCNotCanUpdate) {
			a.badRequestResponse(w, r, err)
			return
		}
		if apierrors.IsConflict(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error deleting PVC: %w", err))
		return
	}

	a.deletedResponse(w, r)
}
