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
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

type PodTemplateOptionsEnvelope Envelope[*models.PodTemplateOptions]

type PodTemplateOptionsListValuesRequestEnvelope Envelope[*models.ListValuesRequest]

// PodTemplateOptionsListValuesHandler retrieves the list of available options values for a pod template workspace kind, filtered based on the provided context.
//
//	@Summary		List options values for a pod template workspace kind
//	@Description	Returns filtered imageConfig and podConfig options based on the provided context.
//	@Tags			workspacekinds
//	@ID				podTemplateOptionsListValues
//	@Accept			json
//	@Produce		json
//	@Param			name	path		string										true	"Name of the workspace kind"	extensions(x-example=jupyterlab)
//	@Param			body	body		PodTemplateOptionsListValuesRequestEnvelope	true	"Request body with optional context filters"
//	@Success		200		{object}	PodTemplateOptionsEnvelope					"Successful operation. Returns filtered options with ruleEffects."
//	@Failure		400		{object}	ErrorEnvelope								"Bad Request. Invalid workspace kind name or request body."
//	@Failure		401		{object}	ErrorEnvelope								"Unauthorized. Authentication is required."
//	@Failure		403		{object}	ErrorEnvelope								"Forbidden. User does not have permission to access the workspace kind."
//	@Failure		404		{object}	ErrorEnvelope								"Not Found. Workspace kind does not exist."
//	@Failure		413		{object}	ErrorEnvelope								"Request Entity Too Large. The request body is too large."
//	@Failure		415		{object}	ErrorEnvelope								"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422		{object}	ErrorEnvelope								"Unprocessable Entity. Validation error."
//	@Failure		500		{object}	ErrorEnvelope								"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspacekinds/{name}/podtemplate/options/listvalues [post]
func (a *App) PodTemplateOptionsListValuesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	name := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateWorkspaceKindName(field.NewPath(ResourceNamePathParam), name)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// validate the Content-Type header
	if success := a.ValidateContentType(w, r, MediaTypeJson); !success {
		return
	}

	// parse request body
	bodyEnvelope := &PodTemplateOptionsListValuesRequestEnvelope{}
	if err := a.DecodeJSON(r, bodyEnvelope); err != nil {
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
		valErrs = append(valErrs, field.Required(dataPath, "data is required"))
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = append(valErrs, bodyEnvelope.Data.Validate(dataPath)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// give the request data a clear name
	listValuesRequest := bodyEnvelope.Data

	// unpack namespace from context
	var namespace string
	if listValuesRequest.Context.Namespace != nil {
		namespace = listValuesRequest.Context.Namespace.Name
	}

	// =========================== AUTH ===========================
	var authPolicies []*auth.ResourcePolicy

	if namespace != "" {
		// user intends to create a workspace in a namespace, and needs the list of options values
		authPolicies = []*auth.ResourcePolicy{
			auth.NewResourcePolicy(auth.VerbCreate, auth.Workspaces, auth.ResourcePolicyResourceMeta{Namespace: namespace}),
		}
	} else {
		// administrative listing of all options values for the workspace kind
		authPolicies = []*auth.ResourcePolicy{
			auth.NewResourcePolicy(auth.VerbGet, auth.WorkspaceKinds, auth.ResourcePolicyResourceMeta{Name: name}),
		}
	}

	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	// list the values for this workspace kind
	listValuesResponse, err := a.repositories.WorkspaceKind.ListPodTemplateOptionsValues(r.Context(), name, listValuesRequest)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		if helper.IsInternalValidationError(err) {
			fieldErrs := helper.FieldErrorsFromInternalValidationError(err)
			a.failedValidationResponse(w, r, errMsgInternalValidation, fieldErrs, nil)
			return
		}
		a.serverErrorResponse(w, r, err)
	}

	responseEnvelope := &PodTemplateOptionsEnvelope{Data: listValuesResponse}
	a.dataResponse(w, r, responseEnvelope)
}
