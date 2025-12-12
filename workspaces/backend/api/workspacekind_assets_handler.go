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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

// getWorkspaceKindAssetHandler is a helper function that handles common logic for retrieving
// and serving workspace kind assets (icon or logo). It validates path parameters, performs
// authentication, retrieves the asset, and serves it.
func (a *App) getWorkspaceKindAssetHandler(
	w http.ResponseWriter,
	r *http.Request,
	ps httprouter.Params,
	getAsset func(icon, logo models.WorkspaceKindAsset) models.WorkspaceKindAsset,
) {
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

	// Get both assets using the helper function
	icon, logo, err := a.repositories.WorkspaceKind.GetWorkspaceKindAssets(r.Context(), name)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	// Get the appropriate asset (icon or logo) using the provided function
	asset := getAsset(icon, logo)

	// Serve the asset
	a.serveWorkspaceKindAsset(w, r, asset)
}

// GetWorkspaceKindIconHandler serves the icon image for a WorkspaceKind.
//
//	@Summary		Get workspace kind icon
//	@Description	Returns the icon image for a specific workspace kind. If the icon is stored in a ConfigMap, it serves the image content. If the icon is a remote URL, returns 404 (browser should fetch directly).
//	@Tags			workspacekinds
//	@ID				getWorkspaceKindIcon
//	@Accept			json
//	@Produce		image/svg+xml
//	@Param			name	path		string			true	"Name of the workspace kind"
//	@Success		200		{string}	string			"SVG image content"
//	@Failure		404		{object}	ErrorEnvelope	"Not Found. Icon uses remote URL or resource does not exist."
//	@Failure		500		{object}	ErrorEnvelope	"Internal server error."
//	@Router			/workspacekinds/{name}/assets/icon.svg [get]
func (a *App) GetWorkspaceKindIconHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	a.getWorkspaceKindAssetHandler(w, r, ps, func(icon, _ models.WorkspaceKindAsset) models.WorkspaceKindAsset {
		return icon
	})
}

// GetWorkspaceKindLogoHandler serves the logo image for a WorkspaceKind.
//
//	@Summary		Get workspace kind logo
//	@Description	Returns the logo image for a specific workspace kind. If the logo is stored in a ConfigMap, it serves the image content. If the logo is a remote URL, returns 404 (browser should fetch directly).
//	@Tags			workspacekinds
//	@ID				getWorkspaceKindLogo
//	@Accept			json
//	@Produce		image/svg+xml
//	@Param			name	path		string			true	"Name of the workspace kind"
//	@Success		200		{string}	string			"SVG image content"
//	@Failure		404		{object}	ErrorEnvelope	"Not Found. Logo uses remote URL or resource does not exist."
//	@Failure		500		{object}	ErrorEnvelope	"Internal server error."
//	@Router			/workspacekinds/{name}/assets/logo.svg [get]
func (a *App) GetWorkspaceKindLogoHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	a.getWorkspaceKindAssetHandler(w, r, ps, func(_, logo models.WorkspaceKindAsset) models.WorkspaceKindAsset {
		return logo
	})
}

// serveWorkspaceKindAsset serves an icon or logo asset from a WorkspaceKind.
// If the asset uses a remote URL, it returns 404 (browser should fetch directly).
// If the asset uses a ConfigMap, it retrieves and serves the content with proper headers.
func (a *App) serveWorkspaceKindAsset(w http.ResponseWriter, r *http.Request, asset models.WorkspaceKindAsset) {
	// If URL is set, return 404 - browser should fetch directly from source
	if asset.URL != nil && *asset.URL != "" {
		a.notFoundResponse(w, r)
		return
	}

	// If ConfigMap is not set, return 404
	if asset.ConfigMap == nil {
		a.notFoundResponse(w, r)
		return
	}

	imageContent, err := a.repositories.WorkspaceKind.GetConfigMapContent(r.Context(), asset)
	if err != nil {
		if apierrors.IsNotFound(err) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error retrieving ConfigMap content: %w", err))
		return
	}

	// Write the SVG response
	a.imageResponse(w, r, []byte(imageContent))
}
