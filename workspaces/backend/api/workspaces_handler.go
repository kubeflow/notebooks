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
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (a *App) GetWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {

	namespace := ps.ByName(NamespacePathParam)

	workspaces, err := a.models.Workspace.GetWorkspaces(r.Context(), a.Client, namespace)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	modelRegistryRes := Envelope{
		"workspaces": workspaces,
	}

	err = a.WriteJSON(w, http.StatusOK, modelRegistryRes, nil)

	if err != nil {
		a.serverErrorResponse(w, r, err)
	}

}
