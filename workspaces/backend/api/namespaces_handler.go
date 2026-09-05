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
	"context"
	"fmt"
	"net/http"

	"github.com/julienschmidt/httprouter"
	"golang.org/x/sync/errgroup"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/namespaces"
)

// namespaceAuthCheckConcurrency bounds the SubjectAccessReviews issued while
// filtering namespaces, so a cluster with many namespaces cannot flood the API
// server with a single request.
const namespaceAuthCheckConcurrency = 16

type NamespaceListEnvelope Envelope[[]models.Namespace]

// GetNamespacesHandler returns the namespaces the caller can use.
//
//	@Summary		List namespaces
//	@Description	Returns the namespaces in which the caller is allowed to list workspaces.
//	@Tags			namespaces
//	@ID				listNamespaces
//	@Produce		application/json
//	@Success		200	{object}	NamespaceListEnvelope	"Successful namespaces response"
//	@Failure		401	{object}	ErrorEnvelope			"Unauthorized"
//	@Failure		403	{object}	ErrorEnvelope			"Forbidden"
//	@Failure		500	{object}	ErrorEnvelope			"Internal server error"
//	@Router			/namespaces [get]
func (a *App) GetNamespacesHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {

	// =========================== AUTH ===========================
	// Authentication only: the response is filtered per namespace below, rather
	// than requiring the caller to hold a cluster-wide permission.
	actor, ok := a.requireAuth(w, r, nil)
	if !ok {
		return
	}
	// ============================================================

	namespaces, err := a.repositories.Namespace.GetNamespaces(r.Context())
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	namespaces, err = a.visibleNamespaces(r.Context(), actor, namespaces)
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &NamespaceListEnvelope{Data: namespaces}
	a.dataResponse(w, r, responseEnvelope)
}

// visibleNamespaces filters namespaces down to those where the actor may list
// workspaces.
//
// There is no Kubernetes API that answers "which namespaces may this user use",
// so each namespace is checked individually. Checks run concurrently because
// each is a round trip to the API server, though the authorizer caches
// decisions between requests.
func (a *App) visibleNamespaces(ctx context.Context, actor user.Info, all []models.Namespace) ([]models.Namespace, error) {
	allowed := make([]bool, len(all))

	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(namespaceAuthCheckConcurrency)
	for i, namespace := range all {
		group.Go(func() error {
			policy := auth.NewResourcePolicy(
				auth.VerbList,
				auth.Workspaces,
				auth.ResourcePolicyResourceMeta{Namespace: namespace.Name},
			)
			decision, _, err := a.RequestAuthZ.Authorize(groupCtx, policy.AttributesFor(actor))
			if err != nil {
				return fmt.Errorf("failed to authorize namespace %q for user %q: %w", namespace.Name, actor.GetName(), err)
			}
			allowed[i] = decision == authorizer.DecisionAllow
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}

	visible := make([]models.Namespace, 0, len(all))
	for i, namespace := range all {
		if allowed[i] {
			visible = append(visible, namespace)
		}
	}
	return visible, nil
}
