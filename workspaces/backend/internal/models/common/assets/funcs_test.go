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
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
)

func TestAssets(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Assets Suite")
}

var _ = Describe("configMapStatusToErrorCode", func() {
	type testCase struct {
		description string
		status      *kubefloworgv1beta1.WorkspaceKindConfigMapStatus
		expected    ImageRefErrorCode
	}

	testCases := []testCase{
		{
			description: "should return empty for nil status",
			status:      nil,
			expected:    "",
		},
		{
			description: "should return empty for status with nil error",
			status:      &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{Error: nil},
			expected:    "",
		},
		{
			description: "should map NotFound to CONFIGMAP_MISSING",
			status: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error: ptr.To(kubefloworgv1beta1.ConfigMapErrorNotFound),
			},
			expected: ImageRefErrorCodeConfigMapMissing,
		},
		{
			description: "should map KeyNotFound to CONFIGMAP_KEY_MISSING",
			status: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error: ptr.To(kubefloworgv1beta1.ConfigMapErrorKeyNotFound),
			},
			expected: ImageRefErrorCodeConfigMapKeyMissing,
		},
		{
			description: "should map Other to CONFIGMAP_UNKNOWN",
			status: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error: ptr.To(kubefloworgv1beta1.ConfigMapErrorOther),
			},
			expected: ImageRefErrorCodeConfigMapUnknown,
		},
		{
			description: "should map unrecognized error to UNKNOWN",
			status: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error: ptr.To(kubefloworgv1beta1.ConfigMapError("SomeFutureError")),
			},
			expected: ImageRefErrorCodeUnknown,
		},
	}

	for _, tc := range testCases {
		It(tc.description, func() {
			result := configMapStatusToErrorCode(tc.status)
			Expect(result).To(Equal(tc.expected))
		})
	}
})

var _ = Describe("BuildImageRef", func() {
	const wkName = "test-wk"
	noStatus := kubefloworgv1beta1.ImageAssetStatus{}
	nilCfg := (*config.EnvConfig)(nil)
	cfgWithPrefix := &config.EnvConfig{UrlPrefix: "/workspaces"}

	It("should return URL directly for URL-based assets", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			Url: ptr.To("https://example.com/icon.png"),
		}
		ref := BuildImageRef(nilCfg, asset, wkName, WorkspaceKindAssetTypeIcon, noStatus)
		Expect(ref.URL).To(Equal("https://example.com/icon.png"))
		Expect(ref.Error).To(BeNil())
	})

	It("should generate API URL for ConfigMap-based assets", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-icons", Key: "icon.svg", Namespace: "default",
			},
		}
		ref := BuildImageRef(nilCfg, asset, wkName, WorkspaceKindAssetTypeIcon, noStatus)
		Expect(ref.URL).To(Equal("/api/v1/workspacekinds/test-wk/assets/icon.svg"))
		Expect(ref.Error).To(BeNil())
	})

	It("should append sha256 query parameter when hash is present", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-icons", Key: "icon.svg", Namespace: "default",
			},
		}
		status := kubefloworgv1beta1.ImageAssetStatus{Sha256: "abc123"}
		ref := BuildImageRef(nilCfg, asset, wkName, WorkspaceKindAssetTypeIcon, status)
		Expect(ref.URL).To(Equal("/api/v1/workspacekinds/test-wk/assets/icon.svg?sha256=abc123"))
		Expect(ref.Error).To(BeNil())
	})

	It("should set error field when ConfigMap status has error", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-icons", Key: "icon.svg", Namespace: "default",
			},
		}
		status := kubefloworgv1beta1.ImageAssetStatus{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error: ptr.To(kubefloworgv1beta1.ConfigMapErrorNotFound),
			},
		}
		ref := BuildImageRef(nilCfg, asset, wkName, WorkspaceKindAssetTypeIcon, status)
		Expect(ref.Error).NotTo(BeNil())
		Expect(*ref.Error).To(Equal(ImageRefErrorCodeConfigMapMissing))
	})

	It("should use logo type in URL for logo assets", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-logos", Key: "logo.svg", Namespace: "default",
			},
		}
		ref := BuildImageRef(nilCfg, asset, wkName, WorkspaceKindAssetTypeLogo, noStatus)
		Expect(ref.URL).To(Equal("/api/v1/workspacekinds/test-wk/assets/logo.svg"))
	})

	It("should return empty URL when neither URL nor ConfigMap is set", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{}
		ref := BuildImageRef(nilCfg, asset, wkName, WorkspaceKindAssetTypeIcon, noStatus)
		Expect(ref.URL).To(BeEmpty())
		Expect(ref.Error).To(BeNil())
	})

	It("should prepend URL prefix for ConfigMap-based assets", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-icons", Key: "icon.svg", Namespace: "default",
			},
		}
		ref := BuildImageRef(cfgWithPrefix, asset, wkName, WorkspaceKindAssetTypeIcon, noStatus)
		Expect(ref.URL).To(Equal("/workspaces/api/v1/workspacekinds/test-wk/assets/icon.svg"))
	})

	It("should not prepend URL prefix for URL-based assets", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			Url: ptr.To("https://example.com/icon.png"),
		}
		ref := BuildImageRef(cfgWithPrefix, asset, wkName, WorkspaceKindAssetTypeIcon, noStatus)
		Expect(ref.URL).To(Equal("https://example.com/icon.png"))
	})

	It("should strip trailing slash from URL prefix", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-icons", Key: "icon.svg", Namespace: "default",
			},
		}
		cfg := &config.EnvConfig{UrlPrefix: "/workspaces/"}
		ref := BuildImageRef(cfg, asset, wkName, WorkspaceKindAssetTypeIcon, noStatus)
		Expect(ref.URL).To(Equal("/workspaces/api/v1/workspacekinds/test-wk/assets/icon.svg"))
	})

	It("should prepend URL prefix with sha256 query parameter", func() {
		asset := kubefloworgv1beta1.WorkspaceKindAsset{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMap{
				Name: "my-icons", Key: "icon.svg", Namespace: "default",
			},
		}
		status := kubefloworgv1beta1.ImageAssetStatus{Sha256: "abc123"}
		ref := BuildImageRef(cfgWithPrefix, asset, wkName, WorkspaceKindAssetTypeIcon, status)
		Expect(ref.URL).To(Equal("/workspaces/api/v1/workspacekinds/test-wk/assets/icon.svg?sha256=abc123"))
	})
})
