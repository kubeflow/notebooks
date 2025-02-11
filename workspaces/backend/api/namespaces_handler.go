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
	corev1 "k8s.io/api/core/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/namespaces"
)

type NamespacesEnvelope Envelope[[]models.Namespace]

func (a *App) GetNamespacesHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&corev1.Namespace{},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	namespaces, err := a.repositories.Namespace.GetNamespaces(r.Context())
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	namespacesEnvelope := NamespacesEnvelope{
		Data: namespaces,
	}

	err = a.WriteJSON(w, http.StatusOK, namespacesEnvelope, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}
