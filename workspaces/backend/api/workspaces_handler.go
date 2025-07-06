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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

type WorkspaceCreateEnvelope Envelope[*models.WorkspaceCreate]

type WorkspaceListEnvelope Envelope[[]models.Workspace]

type WorkspaceEnvelope Envelope[models.Workspace]

// GetWorkspaceHandler retrieves a specific workspace by namespace and name.
//
//	@Summary		Get workspace
//	@Description	Returns details of a specific workspace identified by namespace and workspace name.
//	@Tags			workspaces
//	@Accept			json
//	@Produce		json
//	@Param			namespace		path		string				true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			workspace_name	path		string				true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Success		200				{object}	WorkspaceEnvelope	"Successful operation. Returns the requested workspace details."
//	@Failure		400				{object}	ErrorEnvelope		"Bad Request. Invalid namespace or workspace name format."
//	@Failure		401				{object}	ErrorEnvelope		"Unauthorized. Authentication is required."
//	@Failure		403				{object}	ErrorEnvelope		"Forbidden. User does not have permission to access the workspace."
//	@Failure		404				{object}	ErrorEnvelope		"Not Found. Workspace does not exist."
//	@Failure		500				{object}	ErrorEnvelope		"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{workspace_name} [get]
func (a *App) GetWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
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
			auth.ResourceVerbGet,
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

	workspace, err := a.repositories.Workspace.GetWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceEnvelope{Data: workspace}
	a.dataResponse(w, r, responseEnvelope)
}

// GetWorkspacesHandler returns a list of workspaces.
//
//	@Summary		List workspaces
//	@Description	Returns a list of workspaces. The endpoint supports two modes:
//	@Description	1. List all workspaces across all namespaces (when no namespace is provided)
//	@Description	2. List workspaces in a specific namespace (when namespace is provided)
//	@Tags			workspaces
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string					true	"Namespace to filter workspaces. If not provided, returns all workspaces across all namespaces."	extensions(x-example=kubeflow-user-example-com)
//	@Success		200			{object}	WorkspaceListEnvelope	"Successful operation. Returns a list of workspaces."
//	@Failure		400			{object}	ErrorEnvelope			"Bad Request. Invalid namespace format."
//	@Failure		401			{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope			"Forbidden. User does not have permission to list workspaces."
//	@Failure		500			{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces [get]
//	@Router			/workspaces/{namespace} [get]
func (a *App) GetWorkspacesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	// NOTE: namespace is optional, if not provided, we list all workspaces across all namespaces
	var valErrs field.ErrorList
	if namespace != "" {
		valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	}
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	var workspaces []models.Workspace
	var err error
	if namespace == "" {
		workspaces, err = a.repositories.Workspace.GetAllWorkspaces(r.Context())
	} else {
		workspaces, err = a.repositories.Workspace.GetWorkspaces(r.Context(), namespace)
	}
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceListEnvelope{Data: workspaces}
	a.dataResponse(w, r, responseEnvelope)
}

// CreateWorkspaceHandler creates a new workspace in the specified namespace.
//
//	@Summary		Create workspace
//	@Description	Creates a new workspace in the specified namespace.
//	@Tags			workspaces
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string					true	"Namespace for the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			body		body		WorkspaceCreateEnvelope	true	"Workspace creation configuration"
//	@Success		201			{object}	WorkspaceEnvelope		"Workspace created successfully"
//	@Failure		400			{object}	ErrorEnvelope			"Bad Request. Invalid request body or namespace format."
//	@Failure		401			{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope			"Forbidden. User does not have permission to create workspace."
//	@Failure		409			{object}	ErrorEnvelope			"Conflict. Workspace with the same name already exists."
//	@Failure		413			{object}	ErrorEnvelope			"Request Entity Too Large. The request body is too large."
//	@Failure		415			{object}	ErrorEnvelope			"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		500			{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace} [post]
func (a *App) CreateWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// validate the Content-Type header
	if success := a.ValidateContentType(w, r, MediaTypeJson); !success {
		return
	}

	// decode the request body
	bodyEnvelope := &WorkspaceCreateEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
		if a.IsMaxBytesError(err) {
			a.requestEntityTooLargeResponse(w, r, err)
			return
		}
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

	workspaceCreate := bodyEnvelope.Data

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbCreate,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      workspaceCreate.Name,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	createdWorkspace, err := a.repositories.Workspace.CreateWorkspace(r.Context(), workspaceCreate, namespace)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceAlreadyExists) {
			a.conflictResponse(w, r, err)
			return
		}
		if apierrors.IsInvalid(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.failedValidationResponse(w, r, errMsgKubernetesValidation, nil, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error creating workspace: %w", err))
		return
	}

	// calculate the GET location for the created workspace (for the Location header)
	location := a.LocationGetWorkspace(namespace, createdWorkspace.Name)

	responseEnvelope := &WorkspaceCreateEnvelope{Data: createdWorkspace}
	a.createdResponse(w, r, responseEnvelope, location)
}

// DeleteWorkspaceHandler deletes a specific workspace by namespace and name.
//
//	@Summary		Delete workspace
//	@Description	Deletes a specific workspace identified by namespace and workspace name.
//	@Tags			workspaces
//	@Accept			json
//	@Produce		json
//	@Param			namespace		path		string			true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			workspace_name	path		string			true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Success		204				{object}	nil				"Workspace deleted successfully"
//	@Failure		400				{object}	ErrorEnvelope	"Bad Request. Invalid namespace or workspace name format."
//	@Failure		401				{object}	ErrorEnvelope	"Unauthorized. Authentication is required."
//	@Failure		403				{object}	ErrorEnvelope	"Forbidden. User does not have permission to delete the workspace."
//	@Failure		404				{object}	ErrorEnvelope	"Not Found. Workspace does not exist."
//	@Failure		500				{object}	ErrorEnvelope	"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{workspace_name} [delete]
func (a *App) DeleteWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
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
			auth.ResourceVerbDelete,
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

	err := a.repositories.Workspace.DeleteWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	a.deletedResponse(w, r)
}
