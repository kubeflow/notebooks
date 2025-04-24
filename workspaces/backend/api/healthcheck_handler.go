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

	_ "github.com/kubeflow/notebooks/workspaces/backend/internal/models/health_check"
)

// GetHealthcheckHandler returns the health status of the application.
//
//	@Summary		Returns the health status of the application
//	@Description	Provides a healthcheck response indicating the status of key services.
//	@Tags			healthcheck
//	@Produce		application/json
//	@Success		200	{object}	health_check.HealthCheck	"Successful healthcheck response"
//	@Failure		500	{object}	ErrorEnvelope				"Internal server error"
//	@Router			/healthcheck [get]
func (a *App) GetHealthcheckHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {

	healthCheck, err := a.repositories.HealthCheck.HealthCheck(Version)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	err = a.WriteJSON(w, http.StatusOK, healthCheck, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}
