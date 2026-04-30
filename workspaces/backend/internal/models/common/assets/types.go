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

// ImageRef represents a reference to an image (icon or logo) that can be sourced from a URL or ConfigMap.
type ImageRef struct {
	URL   string             `json:"url"`
	Error *ImageRefErrorCode `json:"error,omitempty"`
}

// ImageRefErrorCode represents error codes for asset retrieval errors.
type ImageRefErrorCode string

const (
	ImageRefErrorCodeConfigMapMissing    ImageRefErrorCode = "CONFIGMAP_MISSING"
	ImageRefErrorCodeConfigMapKeyMissing ImageRefErrorCode = "CONFIGMAP_KEY_MISSING"
	ImageRefErrorCodeConfigMapOther      ImageRefErrorCode = "CONFIGMAP_OTHER"
	ImageRefErrorCodeConfigMapUnknown    ImageRefErrorCode = "CONFIGMAP_UNKNOWN"
)
