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
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

// WorkspaceDetailsEnvelope is the response envelope for workspace details.
type WorkspaceDetailsEnvelope Envelope[*models.WorkspaceDetails]

// GetWorkspaceDetailsHandler returns pod template details for the workspace details overlay.
//
//	@Summary		Get workspace pod template details
//	@Description	Returns detail-level data for the workspace details overlay (volumes, secrets, pod info).
//	@Tags			workspaces
//	@ID				getWorkspacePodTemplateDetails
//	@Produce		application/json
//	@Param			namespace	path		string						true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			name		path		string						true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Success		200			{object}	WorkspaceDetailsEnvelope	"Successful operation."
//	@Failure		401			{object}	ErrorEnvelope				"Unauthorized."
//	@Failure		403			{object}	ErrorEnvelope				"Forbidden."
//	@Failure		404			{object}	ErrorEnvelope				"Workspace not found."
//	@Failure		422			{object}	ErrorEnvelope				"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope				"Internal server error."
//	@Router			/workspaces/{namespace}/{name}/podtemplate/details [get]
func (a *App) GetWorkspaceDetailsHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(constants.NamespacePathParam)
	workspaceName := ps.ByName(constants.ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(constants.NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateWorkspaceName(field.NewPath(constants.ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbGet, auth.Workspaces, auth.ResourcePolicyResourceMeta{Namespace: namespace, Name: workspaceName}),
	}
	if _, ok := a.requireAuth(w, r, authPolicies); !ok {
		return
	}
	// ============================================================

	details, err := a.repositories.Workspace.GetWorkspaceDetails(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceDetailsEnvelope{Data: details}
	a.dataResponse(w, r, responseEnvelope)
}
