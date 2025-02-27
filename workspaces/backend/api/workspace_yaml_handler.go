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
	"fmt"
	"net/http"

	"github.com/julienschmidt/httprouter"

	"errors"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"

	"sigs.k8s.io/yaml"
)

type WorkspaceYAMLEnvelope struct {
	Data string `json:"data"`
}

func (a *App) GetWorkspaceYAMLHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	if namespace == "" || workspaceName == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("namespace or workspace name is empty"))
		return
	}

	workspace, err := a.repositories.Workspace.GetWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, workspaces.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	yamlBytes, err := yaml.Marshal(workspace)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	response := WorkspaceYAMLEnvelope{
		Data: string(yamlBytes),
	}

	err = a.WriteJSON(w, http.StatusOK, response, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}
