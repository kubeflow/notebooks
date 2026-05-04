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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

type wskAssetType string

const (
	wskAssetTypeIcon wskAssetType = "icon"
	wskAssetTypeLogo wskAssetType = "logo"
)

// GetWorkspaceKindIconHandler serves the icon image for a WorkspaceKind.
//
//	@Summary		Get workspace kind icon
//	@Description	Returns the icon image for a specific workspace kind. If the icon is stored in a ConfigMap, it serves the image content. If the icon is a remote URL, returns 404 (browser should fetch directly).
//	@Tags			workspacekinds
//	@ID				getWorkspaceKindIcon
//	@Accept			json
//	@Produce		json
//	@Produce		image/svg+xml
//	@Param			name		path		string			true	"Name of the workspace kind"
//	@Param			namespace	query		string			false	"Namespace to request asset for."	extensions(x-example=kubeflow-user-example-com)
//	@Success		200			{file}		string			"The image file content."
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden. User does not have permission to get asset."
//	@Failure		404			{object}	ErrorEnvelope	"Not Found. Icon uses remote URL or resource does not exist."
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error."
//	@Router			/workspacekinds/{name}/assets/icon [get]
func (a *App) GetWorkspaceKindIconHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	a.getWorkspaceKindAssetHandler(w, r, ps, wskAssetTypeIcon)
}

// GetWorkspaceKindLogoHandler serves the logo image for a WorkspaceKind.
//
//	@Summary		Get workspace kind logo
//	@Description	Returns the logo image for a specific workspace kind. If the logo is stored in a ConfigMap, it serves the image content. If the logo is a remote URL, returns 404 (browser should fetch directly).
//	@Tags			workspacekinds
//	@ID				getWorkspaceKindLogo
//	@Accept			json
//	@Produce		json
//	@Produce		image/svg+xml
//	@Param			name		path		string			true	"Name of the workspace kind"
//	@Param			namespace	query		string			false	"Namespace to request asset for."	extensions(x-example=kubeflow-user-example-com)
//	@Success		200			{file}		string			"The image file content."
//	@Failure		401			{object}	ErrorEnvelope	"Unauthorized. Authentication is required."
//	@Failure		403			{object}	ErrorEnvelope	"Forbidden. User does not have permission to get asset."
//	@Failure		404			{object}	ErrorEnvelope	"Not Found. Logo uses remote URL or resource does not exist."
//	@Failure		422			{object}	ErrorEnvelope	"Unprocessable Entity. Validation error."
//	@Failure		500			{object}	ErrorEnvelope	"Internal server error."
//	@Router			/workspacekinds/{name}/assets/logo [get]
func (a *App) GetWorkspaceKindLogoHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	a.getWorkspaceKindAssetHandler(w, r, ps, wskAssetTypeLogo)
}

// getWorkspaceKindAssetHandler implements the logic to serve a WorkspaceKind asset (icon or logo) based on the assetType parameter.
func (a *App) getWorkspaceKindAssetHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params, assetType wskAssetType) {
	wskName := ps.ByName(constants.ResourceNamePathParam)
	namespace := r.URL.Query().Get(constants.NamespaceQueryParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateWorkspaceKindName(field.NewPath(constants.ResourceNamePathParam), wskName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// validate query parameters
	var queryValErrs field.ErrorList
	if namespace != "" {
		queryValErrs = append(queryValErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(constants.NamespaceQueryParam), namespace)...)
	}
	if len(queryValErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgQueryParamsInvalid, queryValErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	var authPolicies []*auth.ResourcePolicy

	if namespace != "" {
		// user is viewing the asset in the context of a workspace listing, so check list permission on workspaces in the namespace
		authPolicies = []*auth.ResourcePolicy{
			auth.NewResourcePolicy(auth.VerbList, auth.Workspaces, auth.ResourcePolicyResourceMeta{Namespace: namespace}),
		}
	} else {
		// administrative view of a workspace kind
		authPolicies = []*auth.ResourcePolicy{
			auth.NewResourcePolicy(auth.VerbGet, auth.WorkspaceKinds, auth.ResourcePolicyResourceMeta{Name: wskName}),
		}
	}

	if _, ok := a.requireAuth(w, r, authPolicies); !ok {
		return
	}
	// ============================================================

	var assetBytes []byte
	var mediaType kubefloworgv1beta1.WorkspaceKindAssetMediaType
	var err error

	switch assetType {
	case wskAssetTypeIcon:
		assetBytes, mediaType, err = a.repositories.WorkspaceKind.GetWorkspaceKindAssetBytesIcon(r.Context(), wskName)
	case wskAssetTypeLogo:
		assetBytes, mediaType, err = a.repositories.WorkspaceKind.GetWorkspaceKindAssetBytesLogo(r.Context(), wskName)
	default:
		a.serverErrorResponse(w, r, errors.New("invalid asset type"))
		return
	}
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindNotFound) || errors.Is(err, repository.ErrWorkspaceKindAssetNotConfigMap) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	a.wskAssetResponse(w, r, assetBytes, mediaType)
}
