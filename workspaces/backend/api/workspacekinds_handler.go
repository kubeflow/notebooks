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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

type WorkspaceKindsEnvelope Envelope[[]models.WorkspaceKind]

type WorkspaceKindEnvelope Envelope[models.WorkspaceKind]

func (a *App) GetWorkspaceKindHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	name := ps.ByName("name")
	if name == "" {
		a.serverErrorResponse(w, r, fmt.Errorf("workspace kind name is missing"))
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

	workspaceKindEnvelope := WorkspaceKindEnvelope{
		Data: workspaceKind,
	}

	err = a.WriteJSON(w, http.StatusOK, workspaceKindEnvelope, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
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

	workspaceKindsEnvelope := WorkspaceKindsEnvelope{
		Data: workspaceKinds,
	}

	err = a.WriteJSON(w, http.StatusOK, workspaceKindsEnvelope, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}
