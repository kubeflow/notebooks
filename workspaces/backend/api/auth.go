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
	"fmt"
	"net/http"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
)

// requireAuth verifies that the request is authenticated and authorized to take the actions specified by the given policies.
// If this method returns false, the request has been handled and the caller should return immediately.
// If this method returns true, the request is authenticated and authorized to proceed.
// This method should only be called once per request.
func (a *App) requireAuth(w http.ResponseWriter, r *http.Request, policies []*auth.ResourcePolicy) bool {
	ctx := r.Context()

	// if auth is disabled, allow the request to proceed
	if a.Config.DisableAuth {
		return true
	}

	// authenticate the request (extract user and groups from the request headers)
	res, ok, err := a.RequestAuthN.AuthenticateRequest(r)
	if err != nil {
		err = fmt.Errorf("failed to authenticate request: %w", err)
		a.serverErrorResponse(w, r, err)
		return false
	}
	if !ok {
		a.unauthorizedResponse(w, r)
		return false
	}

	// for each policy, check if the user is authorized to take the requested action
	for _, policy := range policies {
		attributes := policy.AttributesFor(res.User)
		authorized, reason, err := a.RequestAuthZ.Authorize(ctx, attributes)
		if err != nil {
			err = fmt.Errorf("failed to authorize request for user %q: %w", res.User.GetName(), err)
			a.serverErrorResponse(w, r, err)
			return false
		}

		if authorized != authorizer.DecisionAllow {
			msg := fmt.Sprintf("authorization was denied for user %q", res.User.GetName())
			if reason != "" {
				msg = fmt.Sprintf("%s: %s", msg, reason)
			}
			a.forbiddenResponse(w, r, msg)
			return false
		}
	}

	return true
}
