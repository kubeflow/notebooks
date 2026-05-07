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

package assets

import (
	"strings"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
)

type wskAssetType string

const (
	wskAssetTypeIcon wskAssetType = "icon"
	wskAssetTypeLogo wskAssetType = "logo"
)

// NewImageRefFromWorkspaceKindAssetIcon creates an ImageRef for an icon asset from a WorkspaceKindAsset and ImageAssetStatus.
func NewImageRefFromWorkspaceKindAssetIcon(cfg *config.EnvConfig, asset kubefloworgv1beta1.WorkspaceKindAsset, status kubefloworgv1beta1.ImageAssetStatus, workspaceKindName string) ImageRef {
	return newImageRefFromWorkspaceKindAsset(cfg, asset, status, workspaceKindName, wskAssetTypeIcon)
}

// NewImageRefFromWorkspaceKindAssetLogo creates an ImageRef for a logo asset from a WorkspaceKindAsset and ImageAssetStatus.
func NewImageRefFromWorkspaceKindAssetLogo(cfg *config.EnvConfig, asset kubefloworgv1beta1.WorkspaceKindAsset, status kubefloworgv1beta1.ImageAssetStatus, workspaceKindName string) ImageRef {
	return newImageRefFromWorkspaceKindAsset(cfg, asset, status, workspaceKindName, wskAssetTypeLogo)
}

// newImageRefFromWorkspaceKindAsset implements the logic to create an ImageRef from a WorkspaceKindAsset and ImageAssetStatus, handling both URL and ConfigMap cases.
func newImageRefFromWorkspaceKindAsset(cfg *config.EnvConfig, asset kubefloworgv1beta1.WorkspaceKindAsset, status kubefloworgv1beta1.ImageAssetStatus, workspaceKindName string, assetType wskAssetType) ImageRef {
	imageRef := ImageRef{}

	// CASE 1: the asset specifies a URL.
	// We return the URL directly.
	if asset.Url != nil {
		imageRef.URL = *asset.Url
		return imageRef
	}

	// CASE 2: the asset references a ConfigMap.
	// We build a path to the backend API that serves the asset from the ConfigMap.
	// Note, the controller pre-calculates as SHA256 of the asset content and includes it in the status to enable caching on the frontend.
	if asset.ConfigMap != nil {
		urlPrefix := ""
		if cfg != nil && cfg.ProxyUrlPrefix != "" {
			urlPrefix = strings.TrimRight(cfg.ProxyUrlPrefix, "/")
		}

		urlPath := ""
		switch assetType {
		case wskAssetTypeIcon:
			urlPath = strings.Replace(constants.WorkspaceKindIconPath, ":"+constants.ResourceNamePathParam, workspaceKindName, 1)
		case wskAssetTypeLogo:
			urlPath = strings.Replace(constants.WorkspaceKindLogoPath, ":"+constants.ResourceNamePathParam, workspaceKindName, 1)
		}

		urlParams := ""
		if status.Sha256 != "" {
			urlParams = "?sha256=" + status.Sha256
		}

		// Combine URL path and parameters
		imageRef.URL = urlPrefix + urlPath + urlParams

		// Set error code if there is an error in the ConfigMap status
		//
		// TODO: consider if we should also bubble the ErrorMessage from the status, so that "other" errors are more transparent to users.
		//
		imageRef.Error = configMapStatusToErrorCode(status.ConfigMap)

		return imageRef
	}

	return imageRef
}

// configMapStatusToErrorCode converts a kubefloworgv1beta1.WorkspaceKindConfigMapStatus to an ImageRefErrorCode.
func configMapStatusToErrorCode(status *kubefloworgv1beta1.WorkspaceKindAssetConfigMapStatus) *ImageRefErrorCode {
	// If status or error is nil, return nil (no error)
	if status == nil || status.Error == nil {
		return nil
	}

	// Map controller error to ImageRefErrorCode
	var errorCode = ImageRefErrorCodeConfigMapUnknown
	switch *status.Error {
	case kubefloworgv1beta1.ConfigMapErrorNotFound:
		errorCode = ImageRefErrorCodeConfigMapMissing
	case kubefloworgv1beta1.ConfigMapErrorKeyNotFound:
		errorCode = ImageRefErrorCodeConfigMapKeyMissing
	case kubefloworgv1beta1.ConfigMapErrorOther:
		errorCode = ImageRefErrorCodeConfigMapOther
	}

	return &errorCode
}
