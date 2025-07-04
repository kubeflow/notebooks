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
	"io"
	"net/http"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

// TODO: this should wrap the models.WorkspaceKindUpdate once we implement the update handler
type WorkspaceKindCreateEnvelope Envelope[*models.WorkspaceKind]

type WorkspaceKindListEnvelope Envelope[[]models.WorkspaceKind]

type WorkspaceKindEnvelope Envelope[models.WorkspaceKind]

// GetWorkspaceKindHandler retrieves a specific workspace kind by name.
//
//	@Summary		Get workspace kind
//	@Description	Returns details of a specific workspace kind identified by its name. Workspace kinds define the available types of workspaces that can be created.
//	@Tags			workspacekinds
//	@Accept			json
//	@Produce		json
//	@Param			name	path		string					true	"Name of the workspace kind"	extensions(x-example=jupyterlab)
//	@Success		200		{object}	WorkspaceKindEnvelope	"Successful operation. Returns the requested workspace kind details."
//	@Failure		400		{object}	ErrorEnvelope			"Bad Request. Invalid workspace kind name format."
//	@Failure		401		{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403		{object}	ErrorEnvelope			"Forbidden. User does not have permission to access the workspace kind."
//	@Failure		404		{object}	ErrorEnvelope			"Not Found. Workspace kind does not exist."
//	@Failure		500		{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspacekinds/{name} [get]
func (a *App) GetWorkspaceKindHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	name := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), name)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbGet,
			&kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: name},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceKind, err := a.repositories.WorkspaceKind.GetWorkspaceKind(r.Context(), name)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceKindEnvelope{Data: workspaceKind}
	a.dataResponse(w, r, responseEnvelope)
}

// GetWorkspaceKindsHandler returns a list of all available workspace kinds.
//
//	@Summary		List workspace kinds
//	@Description	Returns a list of all available workspace kinds. Workspace kinds define the different types of workspaces that can be created in the system.
//	@Tags			workspacekinds
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	WorkspaceKindListEnvelope	"Successful operation. Returns a list of all available workspace kinds."
//	@Failure		401	{object}	ErrorEnvelope				"Unauthorized. Authentication is required."
//	@Failure		403	{object}	ErrorEnvelope				"Forbidden. User does not have permission to list workspace kinds."
//	@Failure		500	{object}	ErrorEnvelope				"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspacekinds [get]
func (a *App) GetWorkspaceKindsHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&kubefloworgv1beta1.WorkspaceKind{},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceKinds, err := a.repositories.WorkspaceKind.GetWorkspaceKinds(r.Context())
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceKindListEnvelope{Data: workspaceKinds}
	a.dataResponse(w, r, responseEnvelope)
}

// CreateWorkspaceKindHandler creates a new workspace kind.
//
//	@Summary		Create workspace kind
//	@Description	Creates a new workspace kind.
//	@Tags			workspacekinds
//	@Accept			application/yaml
//	@Produce		json
//	@Param			body	body		string					true	"Kubernetes YAML manifest of a WorkspaceKind"
//	@Success		201		{object}	WorkspaceKindEnvelope	"WorkspaceKind created successfully"
//	@Failure		400		{object}	ErrorEnvelope			"Bad Request."
//	@Failure		401		{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403		{object}	ErrorEnvelope			"Forbidden. User does not have permission to create WorkspaceKind."
//	@Failure		409		{object}	ErrorEnvelope			"Conflict. WorkspaceKind with the same name already exists."
//	@Failure		413		{object}	ErrorEnvelope			"Request Entity Too Large. The request body is too large.""
//	@Failure		415		{object}	ErrorEnvelope			"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422		{object}	ErrorEnvelope			"Unprocessable Entity. Validation error."
//	@Failure		500		{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspacekinds [post]
func (a *App) CreateWorkspaceKindHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {

	// validate the Content-Type header
	if success := a.ValidateContentType(w, r, MediaTypeYaml); !success {
		return
	}

	// decode the request body
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		if a.IsMaxBytesError(err) {
			a.requestEntityTooLargeResponse(w, r, err)
			return
		}
		a.badRequestResponse(w, r, err)
		return
	}
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err = runtime.DecodeInto(a.StrictYamlSerializer, bodyBytes, workspaceKind)
	if err != nil {
		a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
		return
	}

	// validate the workspace kind
	// NOTE: we only do basic validation so we know it's safe to send to the Kubernetes API server
	//       comprehensive validation will be done by Kubernetes
	// NOTE: checking the name field is non-empty also verifies that the workspace kind is not nil/empty
	var valErrs field.ErrorList
	wskNamePath := field.NewPath("metadata", "name")
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(wskNamePath, workspaceKind.Name)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbCreate,
			&kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKind.Name,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	createdWorkspaceKind, err := a.repositories.WorkspaceKind.Create(r.Context(), workspaceKind)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindAlreadyExists) {
			a.conflictResponse(w, r, err)
			return
		}
		if apierrors.IsInvalid(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.failedValidationResponse(w, r, errMsgKubernetesValidation, nil, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error creating workspace kind: %w", err))
		return
	}

	// calculate the GET location for the created workspace kind (for the Location header)
	location := a.LocationGetWorkspaceKind(createdWorkspaceKind.Name)

	responseEnvelope := &WorkspaceKindCreateEnvelope{Data: createdWorkspaceKind}
	a.createdResponse(w, r, responseEnvelope, location)
}
