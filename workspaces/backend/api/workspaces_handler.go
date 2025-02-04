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
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/julienschmidt/httprouter"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

type WorkspacesEnvelope Envelope[[]models.Workspace]

type WorkspaceEnvelope Envelope[models.Workspace]

func (a *App) GetWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(WorkspaceNamePathParam)

	var workspace models.Workspace
	var err error
	if namespace == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("namespace is nil"))
		return
	}
	if workspaceName == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("workspaceName is nil"))
		return
	}

	workspace, err = a.repositories.Workspace.GetWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	modelRegistryRes := WorkspaceEnvelope{
		Data: workspace,
	}

	err = a.WriteJSON(w, http.StatusOK, modelRegistryRes, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}

}

func (a *App) GetWorkspacesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

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

	modelRegistryRes := WorkspacesEnvelope{
		Data: workspaces,
	}

	err = a.WriteJSON(w, http.StatusOK, modelRegistryRes, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}

func (a *App) CreateWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName("namespace")

	if namespace == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("namespace is missing"))
		return
	}

	workspaceModel := &models.Workspace{}
	if err := json.NewDecoder(r.Body).Decode(workspaceModel); err != nil {
		a.serverErrorResponse(w, r, fmt.Errorf("error decoding JSON: %w", err))
		return
	}

	workspaceModel.Namespace = namespace

	createdWorkspace, err := a.repositories.Workspace.CreateWorkspace(r.Context(), workspaceModel)
	if err != nil {
		a.serverErrorResponse(w, r, fmt.Errorf("error creating workspace: %w", err))
		return
	}

	// Return created workspace as JSON
	workspaceEnvelope := WorkspaceEnvelope{
		Data: createdWorkspace,
	}

	w.Header().Set("Location", r.URL.Path)
	err = a.WriteJSON(w, http.StatusCreated, workspaceEnvelope, nil)
	if err != nil {
		a.serverErrorResponse(w, r, fmt.Errorf("error writing JSON: %w", err))
	}
}

func (a *App) DeleteWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName("namespace")
	workspaceName := ps.ByName("name")

	if namespace == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("namespace is missing"))
		return
	}

	if workspaceName == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("workspace name is missing"))
		return
	}

	err := a.repositories.Workspace.DeleteWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
