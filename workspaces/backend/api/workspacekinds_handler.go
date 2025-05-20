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
	"net/http"
	"strings"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

type WorkspaceKindListEnvelope Envelope[[]models.WorkspaceKind]

type WorkspaceKindEnvelope Envelope[models.WorkspaceKind]

func (a *App) GetWorkspaceKindHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	name := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), name)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbGet,
			&kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: name},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceKind, err := a.repositories.WorkspaceKind.GetWorkspaceKind(r.Context(), name)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceKindEnvelope{Data: workspaceKind}
	a.dataResponse(w, r, responseEnvelope)
}

func (a *App) GetWorkspaceKindsHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&kubefloworgv1beta1.WorkspaceKind{},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceKinds, err := a.repositories.WorkspaceKind.GetWorkspaceKinds(r.Context())
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}
	// ========================== Filtering =======================
	filterParams := r.URL.Query().Get("filter")

	if filterParams != "" {
		for _, filterParam := range strings.Split(filterParams, ",") {
			var filtered []models.WorkspaceKind
			parts := strings.Split(filterParam, "::")
			if len(parts) != 2 {
				a.failedValidationResponse(w, r, "Invalid filter syntax: "+filterParam, nil, nil)
				return
			}

			filterKey := parts[0]
			filterVal := parts[1]
			for _, wk := range workspaceKinds {
				switch filterKey {
				case "name":
					if strings.HasPrefix(wk.Name, filterVal) {
						filtered = append(filtered, wk)
					}

				case "description":
					if strings.EqualFold(wk.Description, filterVal) {
						filtered = append(filtered, wk)
					}

				case "status":
					validStatuses := map[string]bool{
						"active":     true,
						"deprecated": true,
					}
					if !validStatuses[strings.ToLower(filterVal)] {
						a.failedValidationResponse(w, r, "Invalid status value: "+filterVal, nil, nil)
						return
					}
					if (wk.Deprecated && strings.EqualFold("Deprecated", filterVal)) ||
						(!wk.Deprecated && strings.EqualFold("Active", filterVal)) {
						filtered = append(filtered, wk)
					}

				default:
					a.failedValidationResponse(w, r, "Unsupported filter: "+filterKey, nil, nil)
					return
				}
			}
			workspaceKinds = filtered
		}
	}
	// ========== Response ==========
	responseEnvelope := &WorkspaceKindListEnvelope{Data: workspaceKinds}
	a.dataResponse(w, r, responseEnvelope)
}
