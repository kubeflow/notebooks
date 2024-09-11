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
	"github.com/julienschmidt/httprouter"
	"net/http"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

func (a *App) HealthcheckHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {

	// list Workspaces
	//
	// TODO: remove after testing
	//
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	err := a.List(r.Context(), workspaceList)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}
	workspaceListString := ""
	for _, workspace := range workspaceList.Items {
		workspaceListString += workspace.Name + " "
	}

	healthCheck, err := a.models.HealthCheck.HealthCheck(workspaceListString) // TODO: revert to .HealthCheck(Version)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	err = a.WriteJSON(w, http.StatusOK, healthCheck, nil)

	if err != nil {
		a.serverErrorResponse(w, r, err)
	}

}
