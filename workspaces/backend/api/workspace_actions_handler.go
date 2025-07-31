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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/actions"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

type WorkspaceActionPauseEnvelope Envelope[*models.WorkspaceActionPause]

// PauseActionWorkspaceHandler handles setting the paused state of a workspace.
//
//	@Summary		Pause or unpause a workspace
//	@Description	Pauses or unpauses a workspace, stopping or resuming all associated pods.
//	@Tags			workspaces
//	@ID				updateWorkspacePauseState
//	@Accept			json
//	@Produce		json
//	@Param			namespace		path		string							true	"Namespace of the workspace"	extensions(x-example=default)
//	@Param			workspaceName	path		string							true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Param			body			body		WorkspaceActionPauseEnvelope	true	"Intended pause state of the workspace"
//	@Success		200				{object}	WorkspaceActionPauseEnvelope	"Successful action. Returns the current pause state."
//	@Failure		400				{object}	ErrorEnvelope					"Bad Request."
//	@Failure		401				{object}	ErrorEnvelope					"Unauthorized. Authentication is required."
//	@Failure		403				{object}	ErrorEnvelope					"Forbidden. User does not have permission to access the workspace."
//	@Failure		404				{object}	ErrorEnvelope					"Not Found. Workspace does not exist."
//	@Failure		413				{object}	ErrorEnvelope					"Request Entity Too Large. The request body is too large."
//	@Failure		415				{object}	ErrorEnvelope					"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422				{object}	ErrorEnvelope					"Unprocessable Entity. Workspace is not in appropriate state."
//	@Failure		500				{object}	ErrorEnvelope					"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{workspaceName}/actions/pause [post]
func (a *App) PauseActionWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	if success := a.ValidateContentType(w, r, "application/json"); !success {
		return
	}

	bodyEnvelope := &WorkspaceActionPauseEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
		if a.IsMaxBytesError(err) {
			a.requestEntityTooLargeResponse(w, r, err)
			return
		}
		a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
		return
	}

	dataPath := field.NewPath("data")
	if bodyEnvelope.Data == nil {
		valErrs = field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	workspaceActionPause := bodyEnvelope.Data

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbUpdate,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      workspaceName,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceActionPauseState, err := a.repositories.Workspace.HandlePauseAction(r.Context(), namespace, workspaceName, workspaceActionPause)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		if errors.Is(err, repository.ErrWorkspaceInvalidState) {
			a.failedValidationResponse(w, r, err.Error(), nil, nil)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceActionPauseEnvelope{
		Data: workspaceActionPauseState,
	}
	a.dataResponse(w, r, responseEnvelope)
}
