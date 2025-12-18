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

type WorkspaceEnvelope Envelope[*models.WorkspaceUpdate]

type WorkspaceCreateEnvelope Envelope[*models.WorkspaceCreate]

type WorkspaceListEnvelope Envelope[[]models.WorkspaceListItem]

// GetWorkspaceHandler retrieves a specific workspace by namespace and name.
//
//	@Summary		Get workspace
//	@Description	Returns the current state of a specific workspace identified by namespace and workspace name, including the revision for optimistic locking. This endpoint is intended for retrieving the workspace state before updating it.
//	@Tags			workspaces
//	@ID				getWorkspace
//	@Accept			json
//	@Produce		json
//	@Param			namespace		path		string				true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			workspace_name	path		string				true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Success		200				{object}	WorkspaceEnvelope	"Successful operation. Returns the requested workspace details with new revision."
//	@Failure		401				{object}	ErrorEnvelope		"Unauthorized. Authentication is required."
//	@Failure		403				{object}	ErrorEnvelope		"Forbidden. User does not have permission to access the workspace."
//	@Failure		404				{object}	ErrorEnvelope		"Not Found. Workspace does not exist."
//	@Failure		422				{object}	ErrorEnvelope		"Unprocessable Entity. Validation error."
//	@Failure		500				{object}	ErrorEnvelope		"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{workspace_name} [get]
func (a *App) GetWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) { //nolint:dupl // TODO: Abstract common API patterns once implemented
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateWorkspaceName(field.NewPath(ResourceNamePathParam), workspaceName)...)
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

// GetAllWorkspacesHandler returns a list of all workspaces across all namespaces.
//
//	@Summary		List all workspaces
//	@Description	Returns a list of all workspaces across all namespaces.
//	@Tags			workspaces
//	@ID				listAllWorkspaces
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	WorkspaceListEnvelope	"Successful operation. Returns a list of all workspaces."
//	@Failure		401	{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403	{object}	ErrorEnvelope			"Forbidden. User does not have permission to list workspaces."
//	@Failure		500	{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces [get]
func (a *App) GetAllWorkspacesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	a.getWorkspacesHandler(w, r, ps)
}

// GetWorkspacesByNamespaceHandler returns a list of workspaces in a specific namespace.
//
//	@Summary		List workspaces by namespace
//	@Description	Returns a list of workspaces in a specific namespace.
//	@Tags			workspaces
//	@ID				listWorkspacesByNamespace
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string					true	"Namespace to filter workspaces"	extensions(x-example=kubeflow-user-example-com)
//	@Success		200			{object}	WorkspaceListEnvelope	"Successful operation. Returns a list of workspaces in the specified namespace."
//	@Failure		401			{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope			"Forbidden. User does not have permission to list workspaces."
//	@Failure		422			{object}	ErrorEnvelope			"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace} [get]
func (a *App) GetWorkspacesByNamespaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	a.getWorkspacesHandler(w, r, ps)
}

// getWorkspacesHandler is the internal implementation for listing workspaces.
func (a *App) getWorkspacesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	// NOTE: namespace is optional, if not provided, we list all workspaces across all namespaces
	var valErrs field.ErrorList
	if namespace != "" {
		valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
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

	var workspaces []models.WorkspaceListItem
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
//	@ID				createWorkspace
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string					true	"Namespace for the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			body		body		WorkspaceCreateEnvelope	true	"Workspace creation configuration"
//	@Success		201			{object}	WorkspaceCreateEnvelope	"Workspace created successfully"
//	@Failure		400			{object}	ErrorEnvelope			"Bad Request."
//	@Failure		401			{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope			"Forbidden. User does not have permission to create workspace."
//	@Failure		409			{object}	ErrorEnvelope			"Conflict. Workspace with the same name already exists."
//	@Failure		413			{object}	ErrorEnvelope			"Request Entity Too Large. The request body is too large."
//	@Failure		415			{object}	ErrorEnvelope			"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422			{object}	ErrorEnvelope			"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace} [post]
func (a *App) CreateWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
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
		valErrs = field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = bodyEnvelope.Data.Validate(dataPath)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// give the request data a clear name
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
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
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

// UpdateWorkspaceHandler updates an existing workspace.
//
//	@Summary		Update workspace
//	@Description	Updates an existing workspace
//	@Tags			workspaces
//	@ID				updateWorkspace
//	@Accept			json
//	@Produce		json
//	@Param			namespace	path		string				true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			name		path		string				true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Param			body		body		WorkspaceEnvelope	true	"Workspace update configuration"
//	@Success		200			{object}	WorkspaceEnvelope	"Workspace updated successfully"
//	@Failure		400			{object}	ErrorEnvelope		"Bad Request."
//	@Failure		401			{object}	ErrorEnvelope		"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope		"Forbidden. User does not have permission to update workspace."
//	@Failure		409			{object}	ErrorEnvelope		"Conflict. Current workspace revision is newer than provided."
//	@Failure		413			{object}	ErrorEnvelope		"Request Entity Too Large. The request body is too large."
//	@Failure		415			{object}	ErrorEnvelope		"Unsupported Media Type. Content-Type header is not correct."
//	@Failure		422			{object}	ErrorEnvelope		"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope		"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{name} [put]
func (a *App) UpdateWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateWorkspaceName(field.NewPath(ResourceNamePathParam), workspaceName)...)
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

	// validate the Content-Type header
	if success := a.ValidateContentType(w, r, MediaTypeJson); !success {
		return
	}

	// decode the request body
	bodyEnvelope := &WorkspaceEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
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
		valErrs = field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = bodyEnvelope.Data.Validate(dataPath)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	// give the request data a clear name
	workspaceUpdate := bodyEnvelope.Data

	updatedWorkspace, err := a.repositories.Workspace.UpdateWorkspace(r.Context(), workspaceUpdate, namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		if errors.Is(err, repository.ErrWorkspaceRevisionConflict) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
			return
		}
		if apierrors.IsInvalid(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.failedValidationResponse(w, r, errMsgKubernetesValidation, nil, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error updating workspace: %w", err))
		return
	}

	responseEnvelope := &WorkspaceEnvelope{Data: updatedWorkspace}
	a.dataResponse(w, r, responseEnvelope)
}

// DeleteWorkspaceHandler deletes a specific workspace by namespace and name.
//
//	@Summary		Delete workspace
//	@Description	Deletes a specific workspace identified by namespace and workspace name.
//	@Tags			workspaces
//	@ID				deleteWorkspace
//	@Accept			json
//	@Produce		json
//	@Param			namespace		path		string			true	"Namespace of the workspace"	extensions(x-example=kubeflow-user-example-com)
//	@Param			workspace_name	path		string			true	"Name of the workspace"			extensions(x-example=my-workspace)
//	@Success		204				{object}	nil				"Workspace deleted successfully"
//	@Failure		401				{object}	ErrorEnvelope	"Unauthorized. Authentication is required."
//	@Failure		403				{object}	ErrorEnvelope	"Forbidden. User does not have permission to delete the workspace."
//	@Failure		404				{object}	ErrorEnvelope	"Not Found. Workspace does not exist."
//	@Failure		422				{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500				{object}	ErrorEnvelope	"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspaces/{namespace}/{workspace_name} [delete]
func (a *App) DeleteWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateWorkspaceName(field.NewPath(ResourceNamePathParam), workspaceName)...)
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
		} else if apierrors.IsConflict(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.conflictResponse(w, r, err, causes)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	a.deletedResponse(w, r)
}
