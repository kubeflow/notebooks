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
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/julienschmidt/httprouter"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/logs"
)

const (
	logsContainerQueryParam = "container"
	logsTailLinesQueryParam = "tailLines"
	logsPreviousQueryParam  = "previous"
	logSinceTimeQueryParam  = "sinceTime"
)

// GetWorkspaceLogsHandler returns a point-in-time snapshot of container logs for a workspace pod.
//
//	@Summary		Get workspace container logs (batch)
//	@Description	Returns a point-in-time snapshot of container logs for the workspace pod as a raw text/plain stream proxied directly from the Kubernetes pod logs API.
//	@Tags			workspaces
//	@ID				getWorkspaceLogsBatch
//	@Produce		plain
//	@Param			namespace	path		string			true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			name		path		string			true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Param			container	query		string			false	"Target container name. Defaults to the first (primary) container."
//	@Param			tailLines	query		integer			false	"Number of lines from the end of the log to return. Defaults to 1000."
//	@Param			sinceTime	query		string			false	"Only return logs after this RFC3339 timestamp (e.g. 2026-07-15T10:30:00Z)."
//	@Param			previous	query		boolean			false	"If true, returns logs from the previous terminated container instance."
//	@Success		200			{string}	string			"Raw container log stream (text/plain)."
//	@Failure		400			{object}	ErrorEnvelope	"Bad Request. Container not found in workspace pod."
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized."
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden."
//	@Failure		404			{object}	ErrorEnvelope	"Workspace not found."
//	@Failure		409			{object}	ErrorEnvelope	"Conflict. Workspace pod is not running."
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error."
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

	stream, err := a.repositories.Logs.OpenLogStream(r.Context(), namespace, workspaceName, opts)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrWorkspaceNotFound):
			a.notFoundResponseWithMessage(w, r, err)
		case errors.Is(err, repository.ErrPreviousLogsNotFound):
			a.conflictResponse(w, r, err, nil)
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
	defer func() { _ = stream.Close() }()

	// Success responses are always a raw text/plain stream.
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)

	// Proxy the log stream directly to the client.
	if _, err := io.Copy(w, stream); err != nil {
		a.logger.Error("error while streaming workspace logs", "error", err, "namespace", namespace, "workspace", workspaceName)
	}
}

// parseLogOptions parses and validates the log-related query parameters.
func parseLogOptions(r *http.Request) (*models.LogOptions, field.ErrorList) {
	var valErrs field.ErrorList
	query := r.URL.Query()

	opts := &models.LogOptions{
		Container: query.Get(logsContainerQueryParam),
	}

	if raw := query.Get(logsTailLinesQueryParam); raw != "" {
		tail, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || tail <= 0 {
			valErrs = append(valErrs, field.Invalid(field.NewPath(logsTailLinesQueryParam), raw, "must be a positive integer"))
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

	if raw := query.Get(logSinceTimeQueryParam); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			valErrs = append(valErrs, field.Invalid(field.NewPath(logSinceTimeQueryParam), raw, "must be a valid RFC3339 timestamp"))
		} else {
			sinceTime := metav1.NewTime(t)
			opts.SinceTime = &sinceTime
		}
	}

	return opts, valErrs
}
