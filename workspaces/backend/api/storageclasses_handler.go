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
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/storageclasses"
)

type StorageClassListEnvelope Envelope[[]models.StorageClassListItem]

// GetStorageClassesHandler returns a list of all storage classes in the cluster.
//
//	@Summary		List storage classes
//	@Description	Returns a list of all storage classes in the cluster. When namespace is provided, authorization checks whether the user can create PersistentVolumeClaims in that namespace instead of requiring a cluster-wide permission to list storage classes.
//	@Tags			storageclasses
//	@ID				listStorageClasses
//	@Produce		application/json
//	@Param			namespace	query		string						false	"Namespace to request storage classes for."	extensions(x-example=kubeflow-user-example-com)
//	@Success		200			{object}	StorageClassListEnvelope	"Successful storage classes response"
//	@Failure		401			{object}	ErrorEnvelope				"Unauthorized"
//	@Failure		403			{object}	ErrorEnvelope				"Forbidden"
//	@Failure		422			{object}	ErrorEnvelope				"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope				"Internal server error"
//	@Router			/storageclasses [get]
func (a *App) GetStorageClassesHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	namespace := r.URL.Query().Get(constants.NamespaceQueryParam)

	// validate query parameters
	var valErrs field.ErrorList
	if namespace != "" {
		valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(constants.NamespaceQueryParam), namespace)...)
	}
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgQueryParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	var authPolicies []*auth.ResourcePolicy
	if namespace != "" {
		// user intends to create a pvc in the namespace
		authPolicies = []*auth.ResourcePolicy{
			auth.NewResourcePolicy(auth.VerbCreate, auth.PersistentVolumeClaims, auth.ResourcePolicyResourceMeta{Namespace: namespace}),
		}
	} else {
		// administrative listing of storage classes
		authPolicies = []*auth.ResourcePolicy{
			auth.NewResourcePolicy(auth.VerbList, auth.StorageClasses, auth.ResourcePolicyResourceMeta{}),
		}
	}
	if _, ok := a.requireAuth(w, r, authPolicies); !ok {
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
