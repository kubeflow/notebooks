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
	"net/url"

	"github.com/julienschmidt/httprouter"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
)

// AuthzCheckHandler answers external authorization checks from the routing
// layer, using the HTTP protocol of the Gateway API ExternalAuth filter
// (GEP-1494): a 200 response authorizes the request, anything else denies it.
// Istio's envoyExtAuthzHttp extensionProvider speaks the same contract.
//
// The data plane sends the original request's method and headers. Its path
// arrives either appended to this endpoint's prefix (Envoy-based data planes)
// or in a "Path" header (NGINX-based ones), so both are accepted. Workspace
// connect paths require "get" on the target Workspace; other paths only
// require a valid identity, because every other component performs its own
// checks.
//
// The verified identity is returned in response headers so the data plane can
// copy it onto the upstream request, replacing anything the client supplied.
func (a *App) AuthzCheckHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	path, err := originalPath(r, ps)
	if err != nil {
		a.badRequestResponse(w, r, err)
		return
	}

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

// originalPath recovers the path of the request being authorized. The URL wins
// when the data plane appended it; otherwise the Path header is used, which may
// carry a query string. With neither, the request was for the root path.
func originalPath(r *http.Request, ps httprouter.Params) (string, error) {
	if path := ps.ByName(constants.OriginalPathParam); path != "" && path != "/" {
		return path, nil
	}

	header := r.Header.Get(constants.OriginalPathHeader)
	if header == "" {
		return "/", nil
	}
	u, err := url.ParseRequestURI(header)
	if err != nil {
		return "", fmt.Errorf("invalid %s header: %w", constants.OriginalPathHeader, err)
	}
	return u.Path, nil
}
