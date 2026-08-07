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

	"github.com/julienschmidt/httprouter"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/logs"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/podlogs"
)

// GetWorkspacePodTemplateLogsHandler returns a point-in-time snapshot of container logs for a workspace pod.
//
//	@Summary		Get workspace container logs (batch)
//	@Description	Returns a point-in-time snapshot of container logs for the workspace pod as a raw text/plain stream proxied directly from the Kubernetes pod logs API. Each log line is always prefixed with an RFC3339 timestamp.
//	@Tags			workspaces
//	@ID				getWorkspacePodTemplateLogsBatch
//	@Produce		plain
//	@Param			namespace	path		string			true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			name		path		string			true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Param			container	query		string			false	"Target container name. Defaults to the primary (main) container."
//	@Param			tailLines	query		integer			false	"Number of lines from the end of the log to return. Defaults to 1000."
//	@Param			sinceTime	query		string			false	"Only return logs after this RFC3339 timestamp (e.g. 2026-07-15T10:30:00Z)."
//	@Param			previous	query		boolean			false	"If true, returns logs from the previous terminated container instance."
//	@Success		200			{string}	string			"Raw container log stream (text/plain)."
//	@Failure		400			{object}	ErrorEnvelope	"Bad Request. Container not found, pod not running, container not started, or no previous logs available."
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized."
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden."
//	@Failure		404			{object}	ErrorEnvelope	"Workspace not found."
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error."
//	@Router			/workspaces/{namespace}/{name}/podtemplate/logs/batch [get]
func (a *App) GetWorkspacePodTemplateLogsHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
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

	stream, err := a.repositories.PodLogs.OpenLogStream(r.Context(), namespace, workspaceName, opts)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrWorkspaceNotFound):
			a.notFoundResponse(w, r)
		case errors.Is(err, repository.ErrPreviousLogsNotFound):
			a.badRequestResponse(w, r, err)
		case errors.Is(err, repository.ErrPodNotRunning):
			a.badRequestResponse(w, r, err)
		case errors.Is(err, repository.ErrContainerNotFound):
			a.badRequestResponse(w, r, err)
		case errors.Is(err, repository.ErrContainerNotRunning):
			a.badRequestResponse(w, r, err)
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

	opts := &models.LogOptions{}

	if raw := query.Get(constants.ContainerQueryParam); raw != "" {
		errs := helper.ValidateKubernetesContainersName(field.NewPath(constants.ContainerQueryParam), raw)
		if len(errs) > 0 {
			valErrs = append(valErrs, errs...)
		} else {
			opts.Container = raw
		}
	}

	if raw := query.Get(constants.TailLinesQueryParam); raw != "" {
		tail, errs := helper.ValidateFieldIsPositiveInt64(field.NewPath(constants.TailLinesQueryParam), raw)
		if len(errs) > 0 {
			valErrs = append(valErrs, errs...)
		} else {
			opts.TailLines = tail
		}
	}

	if raw := query.Get(constants.PreviousQueryParam); raw != "" {
		previous, errs := helper.ValidateFieldIsBool(field.NewPath(constants.PreviousQueryParam), raw)
		if len(errs) > 0 {
			valErrs = append(valErrs, errs...)
		} else {
			opts.Previous = previous
		}
	}

	if raw := query.Get(constants.SinceTimeQueryParam); raw != "" {
		sinceTime, errs := helper.ValidateFieldIsRFC3339Time(field.NewPath(constants.SinceTimeQueryParam), raw)
		if len(errs) > 0 {
			valErrs = append(valErrs, errs...)
		} else {
			opts.SinceTime = &sinceTime
		}
	}

	return opts, valErrs
}
