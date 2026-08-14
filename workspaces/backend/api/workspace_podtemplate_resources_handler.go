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
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/metrics"
	repoCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/common"
	metricsrepo "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/metrics"
)

// WorkspaceResourceUsageEnvelope is the response envelope for workspace resource usage.
type WorkspaceResourceUsageEnvelope Envelope[*models.WorkspaceResourceUsage]

// GetWorkspacePodTemplateResourcesHandler returns point-in-time resource usage for a workspace.
//
//	@Summary		Get workspace pod template resources
//	@Description	Returns point-in-time CPU and memory usage for each container of the workspace pod, alongside the requests and limits configured in the pod spec. Usage is read from the Kubernetes Metrics Server. A paused or not-yet-running workspace still returns 200 OK with `data.error = WORKSPACE_NOT_RUNNING` and no container data. When the Metrics Server itself is unavailable the response is 503 Service Unavailable.
//	@Tags			workspaces
//	@ID				getWorkspacePodTemplateResources
//	@Produce		json
//	@Param			namespace	path		string							true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			name		path		string							true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Success		200			{object}	WorkspaceResourceUsageEnvelope	"Successful operation. Returns per-container usage and configured resources, or `data.error = WORKSPACE_NOT_RUNNING` when the workspace has no pods."
//	@Failure		401			{object}	ErrorEnvelope					"Unauthorized."
//	@Failure		403			{object}	ErrorEnvelope					"Forbidden."
//	@Failure		404			{object}	ErrorEnvelope					"Workspace not found."
//	@Failure		422			{object}	ErrorEnvelope					"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope					"Internal server error."
//	@Failure		503			{object}	ErrorEnvelope					"Metrics server not available."
//	@Router			/workspaces/{namespace}/{name}/podtemplate/resources [get]
func (a *App) GetWorkspacePodTemplateResourcesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
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

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbGet, auth.Workspaces, auth.ResourcePolicyResourceMeta{Namespace: namespace, Name: workspaceName}),
	}
	if _, ok := a.requireAuth(w, r, authPolicies); !ok {
		return
	}
	// ============================================================

	usage, err := a.repositories.Metrics.GetWorkspaceResourceUsage(r.Context(), namespace, workspaceName)
	if err != nil {
		switch {
		case errors.Is(err, repoCommon.ErrWorkspaceNotFound):
			a.notFoundResponse(w, r)
		case errors.Is(err, metricsrepo.ErrMetricsAPINotAvailable):
			a.serviceUnavailableResponse(w, r, "metrics server not available")
		default:
			a.serverErrorResponse(w, r, err)
		}
		return
	}

	responseEnvelope := &WorkspaceResourceUsageEnvelope{Data: usage}
	a.dataResponse(w, r, responseEnvelope)
}
