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
