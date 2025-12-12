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
	"errors"
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

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

// NewIconAssetInfo creates a WorkspaceKindIconInfo. The type is automatically determined by the struct type.
// Only asset-related errors (as determined by imageRefErrorCode) are stored; other errors are ignored.
func NewIconAssetInfo(sha256 string, err error) WorkspaceKindIconInfo {
	errorCode := imageRefErrorCode(err)

	return WorkspaceKindIconInfo{
		workspaceKindAssetInfo: workspaceKindAssetInfo{
			sha256:    sha256,
			errorCode: errorCode,
		},
	}
}

// NewLogoAssetInfo creates a WorkspaceKindLogoInfo. The type is automatically determined by the struct type.
// Only asset-related errors (as determined by imageRefErrorCode) are stored; other errors are ignored.
func NewLogoAssetInfo(sha256 string, err error) WorkspaceKindLogoInfo {
	errorCode := imageRefErrorCode(err)

	return WorkspaceKindLogoInfo{
		workspaceKindAssetInfo: workspaceKindAssetInfo{
			sha256:    sha256,
			errorCode: errorCode,
		},
	}
}

// NewAssetContext creates a WorkspaceKindAssetContext with icon and logo workspaceKindAssetInfo, automatically setting the types.
func NewAssetContext(iconSHA256, logoSHA256 string, iconErr, logoErr error) *WorkspaceKindAssetContext {
	return &WorkspaceKindAssetContext{
		Icon: NewIconAssetInfo(iconSHA256, iconErr),
		Logo: NewLogoAssetInfo(logoSHA256, logoErr),
	}
}

// imageRefErrorCode maps asset-related errors to ImageRefErrorCode enum values.
// Returns the error code if the error is a known asset error, empty string otherwise.
// This is an internal helper function used by the New***Info constructors and buildImageRef functions.
func imageRefErrorCode(err error) ImageRefErrorCode {
	if err == nil {
		return ""
	}

	switch {
	case errors.Is(err, ErrWorkspaceKindAssetConfigMapNotFound):
		return ImageRefErrorCodeConfigMapMissing
	case errors.Is(err, ErrWorkspaceKindAssetConfigMapKeyNotFound):
		return ImageRefErrorCodeConfigMapKeyMissing
	case errors.Is(err, ErrWorkspaceKindAssetConfigMapUnknown):
		return ImageRefErrorCodeConfigMapUnknown
	default:
		return ImageRefErrorCodeUnknown
	}
}
