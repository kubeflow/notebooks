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
	"strconv"

	"github.com/julienschmidt/httprouter"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/logs"
)

const (
	logsContainerQueryParam = "container"
	logsTailQueryParam      = "tail"
	logsPreviousQueryParam  = "previous"
)

// WorkspaceLogsEnvelope is the response envelope for workspace container logs.
type WorkspaceLogsEnvelope Envelope[models.WorkspaceLogs]

// GetWorkspaceLogsHandler returns a point-in-time snapshot of container logs for a workspace pod.
//
//	@Summary		Get workspace container logs (batch)
//	@Description	Returns a point-in-time snapshot of container logs for the workspace pod as a JSON array of log lines.
//	@Tags			workspaces
//	@ID				getWorkspaceLogsBatch
//	@Produce		json
//	@Param			namespace	path		string					true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			name		path		string					true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Param			container	query		string					false	"Target container name. Defaults to the first (primary) container."
//	@Param			tail		query		integer					false	"Number of lines from the end of the log to return. Defaults to 1000."
//	@Param			previous	query		boolean					false	"If true, returns logs from the previous terminated container instance."
//	@Success		200			{object}	WorkspaceLogsEnvelope	"Successful operation."
//	@Failure		400			{object}	ErrorEnvelope			"Bad Request. Container not found in workspace pod."
//	@Failure		401			{object}	ErrorEnvelope			"Unauthorized."
//	@Failure		403			{object}	ErrorEnvelope			"Forbidden."
//	@Failure		404			{object}	ErrorEnvelope			"Workspace not found."
//	@Failure		409			{object}	ErrorEnvelope			"Conflict. Workspace pod is not running."
//	@Failure		422			{object}	ErrorEnvelope			"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope			"Internal server error."
//	@Router			/workspaces/{namespace}/{name}/podtemplate/logs/batch [get]
func (a *App) GetWorkspaceLogsHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(constants.NamespacePathParam)
	workspaceName := ps.ByName(constants.ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList //nolint:prealloc
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(constants.NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateWorkspaceName(field.NewPath(constants.ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// parse and validate query parameters
	opts, valErrs := parseLogOptions(r)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgQueryParamsInvalid, valErrs, nil)
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

	logs, err := a.repositories.Logs.GetWorkspaceLogs(r.Context(), namespace, workspaceName, opts)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrWorkspaceNotFound):
			a.notFoundResponse(w, r)
		case errors.Is(err, repository.ErrPreviousLogsNotFound):
			a.notFoundResponse(w, r)
		case errors.Is(err, repository.ErrPodNotRunning):
			a.conflictResponse(w, r, err, nil)
		case errors.Is(err, repository.ErrContainerNotFound):
			a.badRequestResponse(w, r, err)
		case errors.Is(err, repository.ErrContainerNotRunning):
			a.conflictResponse(w, r, err, nil)
		default:
			a.serverErrorResponse(w, r, err)
		}
		return
	}

	responseEnvelope := &WorkspaceLogsEnvelope{Data: logs}
	a.dataResponse(w, r, responseEnvelope)
}

// parseLogOptions parses and validates the log-related query parameters.
func parseLogOptions(r *http.Request) (*models.LogOptions, field.ErrorList) {
	var valErrs field.ErrorList
	query := r.URL.Query()

	opts := &models.LogOptions{
		Container: query.Get(logsContainerQueryParam),
	}

	if raw := query.Get(logsTailQueryParam); raw != "" {
		tail, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || tail <= 0 {
			valErrs = append(valErrs, field.Invalid(field.NewPath(logsTailQueryParam), raw, "must be a positive integer"))
		} else {
			opts.TailLines = tail
		}
	}

	if raw := query.Get(logsPreviousQueryParam); raw != "" {
		previous, err := strconv.ParseBool(raw)
		if err != nil {
			valErrs = append(valErrs, field.Invalid(field.NewPath(logsPreviousQueryParam), raw, "must be a boolean"))
		} else {
			opts.Previous = previous
		}
	}

	return opts, valErrs
}
