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
	"net/http"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

// PauseWorkspaceHandler handles the pause workspace action
//
//	@Summary		Pause workspace
//	@Description	Pauses a workspace, stopping all associated pods.
//	@Tags			workspaces
//	@Accept			json
//	@Produce		json
//	@Param			namespace		path		string			true	"Namespace of the workspace"	example(default)
//	@Param			workspaceName	path		string			true	"Name of the workspace"			example(my-workspace)
//	@Success		200				{object}	EmptyResponse	"Successful action. Returns an empty JSON object."
//	@Failure		400				{object}	ErrorEnvelope	"Bad Request. Invalid workspace kind name format."
//	@Failure		401				{object}	ErrorEnvelope	"Unauthorized. Authentication is required."
//	@Failure		403				{object}	ErrorEnvelope	"Forbidden. User does not have permission to access the workspace."
//	@Failure		404				{object}	ErrorEnvelope	"Not Found. Workspace does not exist."
//	@Failure		500				{object}	ErrorEnvelope	"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{workspaceName}/actions/pause [post]
//	@Security		ApiKeyAuth
func (a *App) PauseWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

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

	err := a.repositories.Workspace.PauseWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	// Return 200 OK with empty JSON object
	err = a.WriteJSON(w, http.StatusOK, EmptyResponse{}, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}
}
