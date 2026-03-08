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

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/storageclasses"
)

type StorageClassListEnvelope Envelope[[]models.StorageClassListItem]

// GetStorageClassesHandler returns a list of all storage classes in the cluster.
//
//	@Summary		List storage classes
//	@Description	Returns a list of all storage classes in the cluster.
//	@Tags			storageclasses
//	@ID				listStorageClasses
//	@Produce		application/json
//	@Success		200	{object}	StorageClassListEnvelope	"Successful storage classes response"
//	@Failure		401	{object}	ErrorEnvelope				"Unauthorized"
//	@Failure		403	{object}	ErrorEnvelope				"Forbidden"
//	@Failure		500	{object}	ErrorEnvelope				"Internal server error"
//	@Router			/storageclasses [get]
func (a *App) GetStorageClassesHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbList, auth.StorageClasses, auth.ResourcePolicyResourceMeta{}),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	storageClasses, err := a.repositories.StorageClass.GetStorageClasses(r.Context())
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &StorageClassListEnvelope{Data: storageClasses}
	a.dataResponse(w, r, responseEnvelope)
}
