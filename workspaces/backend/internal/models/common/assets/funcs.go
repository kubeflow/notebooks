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
	"strings"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
)

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

// BuildImageRef creates an ImageRef from a WorkspaceKindAsset and its corresponding status.
// If the asset uses a URL, it returns the URL directly.
// If the asset uses a ConfigMap, it generates a backend API URL with an optional SHA256 hash
// as a query parameter, and sets the Error field if the status indicates a ConfigMap error.
func BuildImageRef(cfg *config.EnvConfig, asset kubefloworgv1beta1.WorkspaceKindAsset, workspaceKindName string, assetType WorkspaceKindAssetType, status kubefloworgv1beta1.ImageAssetStatus) ImageRef {
	if asset.Url != nil && *asset.Url != "" {
		return ImageRef{
			URL: *asset.Url,
		}
	}

	// If ConfigMap is set, generate backend API URL
	if asset.ConfigMap != nil {
		url := fmt.Sprintf("/api/v1/workspacekinds/%s/assets/%s.svg", workspaceKindName, assetType)
		// Append SHA256 hash as query parameter if provided
		if status.Sha256 != "" {
			url = fmt.Sprintf("%s?sha256=%s", url, status.Sha256)
		}

		// Apply URL prefix for reverse proxy path rewriting (e.g., Istio VirtualService)
		if cfg != nil && cfg.UrlPrefix != "" {
			url = strings.TrimRight(cfg.UrlPrefix, "/") + url
		}

		imageRef := ImageRef{
			URL: url,
		}

		// If there was an error retrieving the ConfigMap, set the error field
		if errorCode := configMapStatusToErrorCode(status.ConfigMap); errorCode != "" {
			imageRef.Error = &errorCode
		}

		return imageRef
	}

	// Neither URL nor ConfigMap is set - return empty URL
	return ImageRef{
		URL: "",
	}
}
