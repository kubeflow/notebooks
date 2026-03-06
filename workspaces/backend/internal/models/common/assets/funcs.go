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
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

// NewAssetContextFromStatus creates a WorkspaceKindAssetContext from the controller's
// ImageAssetStatus fields, reading SHA256 hashes and error codes directly from WK status
// instead of computing them in the backend.
func NewAssetContextFromStatus(iconStatus, logoStatus kubefloworgv1beta1.ImageAssetStatus) *WorkspaceKindAssetContext {
	return &WorkspaceKindAssetContext{
		Icon: WorkspaceKindIconInfo{
			workspaceKindAssetInfo: workspaceKindAssetInfo{
				sha256:    iconStatus.Sha256,
				errorCode: configMapStatusToErrorCode(iconStatus.ConfigMap),
			},
		},
		Logo: WorkspaceKindLogoInfo{
			workspaceKindAssetInfo: workspaceKindAssetInfo{
				sha256:    logoStatus.Sha256,
				errorCode: configMapStatusToErrorCode(logoStatus.ConfigMap),
			},
		},
	}
}

// configMapStatusToErrorCode maps the controller's ConfigMapError enum to an ImageRefErrorCode.
// Returns empty string if status is nil or has no error.
func configMapStatusToErrorCode(status *kubefloworgv1beta1.WorkspaceKindConfigMapStatus) ImageRefErrorCode {
	if status == nil || status.Error == nil {
		return ""
	}
	switch *status.Error {
	case kubefloworgv1beta1.ConfigMapErrorNotFound:
		return ImageRefErrorCodeConfigMapMissing
	case kubefloworgv1beta1.ConfigMapErrorKeyNotFound:
		return ImageRefErrorCodeConfigMapKeyMissing
	case kubefloworgv1beta1.ConfigMapErrorOther:
		return ImageRefErrorCodeConfigMapUnknown
	default:
		return ImageRefErrorCodeUnknown
	}
}

// SHA256 returns the SHA256 hash of the asset.
func (a workspaceKindAssetInfo) SHA256() string {
	return a.sha256
}

// ErrorCode returns the error code that occurred when retrieving the asset.
func (a workspaceKindAssetInfo) ErrorCode() ImageRefErrorCode {
	return a.errorCode
}

// Type returns the type of asset as a string. This method should be overridden by WorkspaceKindIconInfo and WorkspaceKindLogoInfo.
func (a workspaceKindAssetInfo) Type() string {
	return "" // Base implementation returns empty - should not be called directly
}

// Type returns WorkspaceKindAssetTypeIcon for icon assets.
func (WorkspaceKindIconInfo) Type() string {
	return string(WorkspaceKindAssetTypeIcon)
}

// Type returns WorkspaceKindAssetTypeLogo for logo assets.
func (WorkspaceKindLogoInfo) Type() string {
	return string(WorkspaceKindAssetTypeLogo)
}

// BuildImageRef creates an ImageRef from a WorkspaceKindAsset.
// If the asset uses a URL, it returns the URL directly.
// If the asset uses a ConfigMap, it generates a backend API URL with an optional SHA256 hash as a query parameter.
// If assetInfo.ErrorCode() returns a non-empty string, the Error field will be set in the ImageRef.
func BuildImageRef(asset kubefloworgv1beta1.WorkspaceKindAsset, workspaceKindName string, assetInfo WorkspaceKindAssetDetails) ImageRef {
	if asset.Url != nil && *asset.Url != "" {
		return ImageRef{
			URL: *asset.Url,
		}
	}

	// If ConfigMap is set, generate backend API URL
	if asset.ConfigMap != nil {
		url := fmt.Sprintf("/api/v1/workspacekinds/%s/assets/%s.svg", workspaceKindName, assetInfo.Type())
		// Append SHA256 hash as query parameter if provided
		if assetInfo.SHA256() != "" {
			url = fmt.Sprintf("%s?sha256=%s", url, assetInfo.SHA256())
		}

		imageRef := ImageRef{
			URL: url,
		}

		// If there was an error retrieving the ConfigMap, set the error field
		if errorCode := assetInfo.ErrorCode(); errorCode != "" {
			imageRef.Error = &errorCode
		}

		return imageRef
	}

	// Neither URL nor ConfigMap is set - return empty URL
	return ImageRef{
		URL: "",
	}
}
