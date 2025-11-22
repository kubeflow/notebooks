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

import "errors"

// ImageRef represents a reference to an image (icon or logo) that can be sourced from a URL or ConfigMap.
type ImageRef struct {
	URL   string             `json:"url"`
	Error *ImageRefErrorCode `json:"error,omitempty"`
}

// ImageRefErrorCode represents error codes for asset retrieval errors.
// This is used both internally and in API responses to indicate errors when retrieving assets from ConfigMaps.
type ImageRefErrorCode string

const (
	ImageRefErrorCodeConfigMapMissing    ImageRefErrorCode = "CONFIGMAP_MISSING"
	ImageRefErrorCodeConfigMapKeyMissing ImageRefErrorCode = "CONFIGMAP_KEY_MISSING"
	ImageRefErrorCodeConfigMapUnknown    ImageRefErrorCode = "CONFIGMAP_UNKNOWN"
	ImageRefErrorCodeUnknown             ImageRefErrorCode = "UNKNOWN"
)

// Errors related to asset retrieval from ConfigMaps.
// These are used by both workspacekinds and workspaces repositories.
var (
	ErrWorkspaceKindAssetConfigMapNotFound    = errors.New("workspace kind asset configmap not found")
	ErrWorkspaceKindAssetConfigMapKeyNotFound = errors.New("workspace kind asset configmap key not found")
	ErrWorkspaceKindAssetConfigMapUnknown     = errors.New("workspace kind asset configmap unknown")
)

// WorkspaceKindAssetType represents the type of asset (icon or logo).
// This type is used by both workspacekinds and workspaces packages.
type WorkspaceKindAssetType string

const (
	// WorkspaceKindAssetTypeIcon represents the icon asset type.
	WorkspaceKindAssetTypeIcon WorkspaceKindAssetType = "icon"
	// WorkspaceKindAssetTypeLogo represents the logo asset type.
	WorkspaceKindAssetTypeLogo WorkspaceKindAssetType = "logo"
)

// WorkspaceKindAsset represents an asset (icon or logo) for a WorkspaceKind.
// It can be sourced from either a URL or a ConfigMap, but not both.
// This type is used by both workspacekinds and workspaces packages.
type WorkspaceKindAsset struct {
	// URL is an optional remote URL to the asset.
	// If set, the asset should be fetched directly from this URL.
	URL *string `json:"url,omitempty"`

	// ConfigMap is an optional reference to a ConfigMap containing the asset.
	// If set, the asset is stored in a ConfigMap and should be retrieved from there.
	ConfigMap *WorkspaceKindAssetConfigMap `json:"configMap,omitempty"`
}

// WorkspaceKindAssetConfigMap represents a reference to a ConfigMap containing an asset.
// This type is used by both workspacekinds and workspaces packages.
type WorkspaceKindAssetConfigMap struct {
	// Name is the name of the ConfigMap.
	Name string `json:"name"`

	// Key is the key within the ConfigMap that contains the asset data.
	Key string `json:"key"`

	// Namespace is the namespace where the ConfigMap is located.
	Namespace string `json:"namespace"`
}

// WorkspaceKindAssetDetails defines the interface for asset information.
// Both WorkspaceKindIconInfo and WorkspaceKindLogoInfo implement this interface.
// This interface is used by both workspacekinds and workspaces packages.
type WorkspaceKindAssetDetails interface {
	Type() string // Returns the asset type as a string (e.g., "icon" or "logo")
	SHA256() string
	ErrorCode() ImageRefErrorCode
}

// workspaceKindAssetInfo contains metadata about an asset (icon or logo).
// This type is used internally within the assets package.
type workspaceKindAssetInfo struct {
	// SHA256 is the SHA256 hash of the asset content (for ConfigMap-based assets).
	// Empty string if the asset uses a URL or if the hash is not available.
	sha256 string

	// ErrorCode is the error code for errors that occurred when retrieving the asset from a ConfigMap.
	// This is set when the ConfigMap doesn't exist or lacks the required label.
	// Empty string if there was no error or if the asset uses a URL.
	errorCode ImageRefErrorCode
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

// WorkspaceKindIconInfo contains metadata about an icon asset.
// It embeds workspaceKindAssetInfo and automatically returns "icon" for Type().
// This type is used by both workspacekinds and workspaces packages.
type WorkspaceKindIconInfo struct {
	workspaceKindAssetInfo
}

// Type returns WorkspaceKindAssetTypeIcon for icon assets.
func (WorkspaceKindIconInfo) Type() string {
	return string(WorkspaceKindAssetTypeIcon)
}

// WorkspaceKindLogoInfo contains metadata about a logo asset.
// It embeds workspaceKindAssetInfo and automatically returns WorkspaceKindAssetTypeLogo for Type().
// This type is used by both workspacekinds and workspaces packages.
type WorkspaceKindLogoInfo struct {
	workspaceKindAssetInfo
}

// Type returns WorkspaceKindAssetTypeLogo for logo assets.
func (WorkspaceKindLogoInfo) Type() string {
	return string(WorkspaceKindAssetTypeLogo)
}

// WorkspaceKindAssetContext contains asset information for both icon and logo.
// This type is used by both workspacekinds and workspaces packages.
type WorkspaceKindAssetContext struct {
	// Icon contains metadata about the icon asset.
	Icon WorkspaceKindIconInfo

	// Logo contains metadata about the logo asset.
	Logo WorkspaceKindLogoInfo
}
