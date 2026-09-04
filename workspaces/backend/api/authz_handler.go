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

	"github.com/julienschmidt/httprouter"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
)

// AuthzCheckHandler answers external authorization checks from the routing
// layer, using the HTTP protocol of the Gateway API ExternalAuth filter
// (GEP-1494): a 200 response authorizes the request, anything else denies it.
// Istio's envoyExtAuthzHttp extensionProvider speaks the same contract.
//
// The data plane sends the original request's path appended to this endpoint's
// prefix, with the original headers. Workspace connect paths require "get" on
// the target Workspace; other paths only require a valid identity, because
// every other component performs its own checks.
//
// The verified identity is returned in response headers so the data plane can
// copy it onto the upstream request, replacing anything the client supplied.
func (a *App) AuthzCheckHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	path := ps.ByName(constants.OriginalPathParam)

	policies, err := auth.PoliciesForPath(path)
	if err != nil {
		if errors.Is(err, auth.ErrMalformedConnectPath) {
			a.badRequestResponse(w, r, err)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	actor, ok := a.requireAuth(w, r, policies)
	if !ok {
		return
	}

	w.Header().Set(a.Config.UserIdHeader, actor.GetName())
	for _, group := range actor.GetGroups() {
		w.Header().Add(a.Config.GroupsHeader, group)
	}
	w.WriteHeader(http.StatusOK)
}
