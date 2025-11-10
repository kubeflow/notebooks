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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	commonAssets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
)

// NewWorkspaceKindAssetFromWorkspaceKind converts a controller WorkspaceKindAsset to a backend model WorkspaceKindAsset.
// This function maintains decoupling between the controller and backend packages.
func NewWorkspaceKindAssetFromWorkspaceKind(wsk *kubefloworgv1beta1.WorkspaceKind, assetType commonAssets.WorkspaceKindAssetType) commonAssets.WorkspaceKindAsset {
	var asset kubefloworgv1beta1.WorkspaceKindAsset
	switch assetType {
	case commonAssets.WorkspaceKindAssetTypeIcon:
		asset = wsk.Spec.Spawner.Icon
	case commonAssets.WorkspaceKindAssetTypeLogo:
		asset = wsk.Spec.Spawner.Logo
	default:
		// Return empty asset if invalid assetType (should not happen with enum)
		return commonAssets.WorkspaceKindAsset{}
	}

	result := commonAssets.WorkspaceKindAsset{}

	if asset.ConfigMap != nil {
		result.ConfigMap = &commonAssets.WorkspaceKindAssetConfigMap{
			Name:      asset.ConfigMap.Name,
			Key:       asset.ConfigMap.Key,
			Namespace: asset.ConfigMap.Namespace,
		}
	} else {
		result.URL = asset.Url
	}

	return result
}
