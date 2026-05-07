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
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// assetTestCase defines a single test case for the workspace kind asset handlers.
type assetTestCase struct {
	assetType wskAssetType
	wskName   string
	namespace string
	user      string

	expectedStatus      int
	expectedContentType string

	validateBodyFunc func(body []byte)
}

// newErrorMessageValidationFunc validates a body contains an ErrorEnvelope with the expected error message.
//
// TODO: move this to a test helpers package/file
func newErrorMessageValidationFunc(expectedMessage string) func(body []byte) {
	return func(body []byte) {
		By("decoding the error response")
		var response ErrorEnvelope
		err := json.Unmarshal(body, &response)
		Expect(err).NotTo(HaveOccurred())

		By("verifying the error message")
		Expect(response.Error.Message).To(Equal(expectedMessage))
	}
}

// assetTestRequest builds and executes an HTTP GET request against an asset handler,
// returning the response recorder for assertion.
func assetTestRequest(handler httprouter.Handle, wskName, namespace, user string, assetType wskAssetType) *httptest.ResponseRecorder {
	By("creating the HTTP request")
	var path string
	switch assetType {
	case wskAssetTypeIcon:
		path = constants.WorkspaceKindIconPath
	case wskAssetTypeLogo:
		path = constants.WorkspaceKindLogoPath
	case "":
		Fail("assetType must be specified in test case")
	default:
		Fail("invalid asset type: " + string(assetType))
	}
	path = strings.Replace(path, ":"+constants.ResourceNamePathParam, wskName, 1)
	if namespace != "" {
		path += "?" + constants.NamespaceQueryParam + "=" + namespace
	}
	req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
	Expect(err).NotTo(HaveOccurred())

	By("setting the auth headers")
	if user != "" {
		req.Header.Set(userIdHeader, user)
	}

	By("executing the request")
	ps := httprouter.Params{
		httprouter.Param{Key: constants.ResourceNamePathParam, Value: wskName},
	}
	rr := httptest.NewRecorder()
	handler(rr, req, ps)

	return rr
}

// assertAssetResponse executes an asset handler request and asserts the response
// matches the expected status code, content type, and body content.
func assertAssetResponse(handler httprouter.Handle, tc *assetTestCase) {
	rr := assetTestRequest(handler, tc.wskName, tc.namespace, tc.user, tc.assetType)
	rs := rr.Result()
	defer rs.Body.Close()

	By("verifying the HTTP response status code")
	Expect(rs.StatusCode).To(Equal(tc.expectedStatus), descUnexpectedHTTPStatus, rr.Body.String())

	gotContentType := rs.Header.Get("Content-Type")
	if tc.expectedContentType != "" {
		By("verifying the HTTP response content type")
		Expect(gotContentType).To(Equal(tc.expectedContentType), descUnexpectedHTTPHeaderContentType, tc.expectedContentType, gotContentType)
	}

	By("reading the HTTP response body")
	body, err := io.ReadAll(rs.Body)
	Expect(err).NotTo(HaveOccurred())

	By("verifying the HTTP response body matches")
	tc.validateBodyFunc(body)
}

// newImageSourceConfigMap creates a ConfigMap with the image-source label required
// by the filtered cache client.
func newImageSourceConfigMap(name, namespace string, data map[string]string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				helper.LabelImageSource: "true",
			},
		},
		Data: data,
	}
}

// newConfigMapWorkspaceKind creates a WorkspaceKind with ConfigMap-based icon and logo assets.
func newConfigMapWorkspaceKind(name, cmName, cmNamespace, iconKey, logoKey string) *kubefloworgv1beta1.WorkspaceKind {
	wk := NewExampleWorkspaceKind(name)
	wk.Spec.Spawner.Icon = kubefloworgv1beta1.WorkspaceKindAsset{
		ConfigMap: &kubefloworgv1beta1.WorkspaceKindAssetConfigMap{
			Name:      cmName,
			Key:       iconKey,
			Namespace: cmNamespace,
			MediaType: kubefloworgv1beta1.WorkspaceKindAssetMediaTypeSVG,
		},
	}
	wk.Spec.Spawner.Logo = kubefloworgv1beta1.WorkspaceKindAsset{
		ConfigMap: &kubefloworgv1beta1.WorkspaceKindAssetConfigMap{
			Name:      cmName,
			Key:       logoKey,
			Namespace: cmNamespace,
			MediaType: kubefloworgv1beta1.WorkspaceKindAssetMediaTypeSVG,
		},
	}
	return wk
}

var _ = Describe("WorkspaceKind Asset Handlers", func() {

	Context("with ConfigMap-based and URL-based WorkspaceKinds", Serial, Ordered, func() {

		const (
			namespaceName = "wsk-asset-test-ns"
			configMapName = "wsk-asset-test-icons"
			wskCMName     = "wsk-asset-test-cm"
			wskURLName    = "wsk-asset-test-url"
			iconKey       = "icon.svg"
			logoKey       = "logo.svg"
			svgContent    = "<svg>test</svg>"
		)

		BeforeAll(func() {
			By("creating the test namespace")
			ns := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			}
			Expect(k8sClient.Create(ctx, ns)).To(Succeed())

			By("creating the image source ConfigMap")
			cm := newImageSourceConfigMap(configMapName, namespaceName, map[string]string{
				iconKey: svgContent,
				logoKey: svgContent,
			})
			Expect(k8sClient.Create(ctx, cm)).To(Succeed())

			By("creating the ConfigMap-based WorkspaceKind")
			wkCM := newConfigMapWorkspaceKind(wskCMName, configMapName, namespaceName, iconKey, logoKey)
			Expect(k8sClient.Create(ctx, wkCM)).To(Succeed())

			By("creating the URL-based WorkspaceKind")
			wkURL := NewExampleWorkspaceKind(wskURLName)
			Expect(k8sClient.Create(ctx, wkURL)).To(Succeed())

			By("waiting for the filtered ConfigMap cache to sync")
			Eventually(func() int {
				req, err := http.NewRequest(http.MethodGet, "/api/v1/workspacekinds/"+wskCMName+"/assets/icon", http.NoBody)
				if err != nil {
					return -1
				}
				req.Header.Set(userIdHeader, adminUser)
				ps := httprouter.Params{
					httprouter.Param{Key: constants.ResourceNamePathParam, Value: wskCMName},
				}
				rr := httptest.NewRecorder()
				a.GetWorkspaceKindIconHandler(rr, req, ps)
				return rr.Code
			}, "10s", "250ms").Should(Equal(http.StatusOK))
		})

		AfterAll(func() {
			By("deleting the ConfigMap-based WorkspaceKind")
			Expect(k8sClient.Delete(ctx, &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: wskCMName},
			})).To(Succeed())

			By("deleting the URL-based WorkspaceKind")
			Expect(k8sClient.Delete(ctx, &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: wskURLName},
			})).To(Succeed())

			By("deleting the ConfigMap")
			Expect(k8sClient.Delete(ctx, &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{Name: configMapName, Namespace: namespaceName},
			})).To(Succeed())

			By("deleting the test namespace")
			Expect(k8sClient.Delete(ctx, &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			})).To(Succeed())
		})

		DescribeTable("GetWorkspaceKindIconHandler",
			func(tc assetTestCase) {
				assertAssetResponse(a.GetWorkspaceKindIconHandler, &tc)
			},
			Entry("should return 200 for ConfigMap-based icon", assetTestCase{
				assetType:           wskAssetTypeIcon,
				wskName:             wskCMName,
				user:                adminUser,
				expectedStatus:      http.StatusOK,
				expectedContentType: constants.MediaTypeSVG,
				validateBodyFunc: func(body []byte) {
					Expect(body).To(BeEquivalentTo(svgContent))
				},
			}),
			Entry("should return 200 for ConfigMap-based icon with namespace query", assetTestCase{
				assetType:           wskAssetTypeIcon,
				wskName:             wskCMName,
				namespace:           namespaceName,
				user:                adminUser,
				expectedStatus:      http.StatusOK,
				expectedContentType: constants.MediaTypeSVG,
				validateBodyFunc: func(body []byte) {
					Expect(body).To(BeEquivalentTo(svgContent))
				},
			}),
			Entry("should return 404 for non-existent WorkspaceKind", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          "non-existent-wsk",
				user:             adminUser,
				expectedStatus:   http.StatusNotFound,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgNotFound),
			}),
			Entry("should return 404 for URL-based icon", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          wskURLName,
				user:             adminUser,
				expectedStatus:   http.StatusNotFound,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgNotFound),
			}),
			Entry("should return 422 for invalid workspace kind name", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          "INVALID!!!",
				user:             adminUser,
				expectedStatus:   http.StatusUnprocessableEntity,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgPathParamsInvalid),
			}),
			Entry("should return 422 for invalid namespace query parameter", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          wskCMName,
				namespace:        "INVALID!!!",
				user:             adminUser,
				expectedStatus:   http.StatusUnprocessableEntity,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgQueryParamsInvalid),
			}),
			Entry("should return 401 when no authentication is provided", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          wskCMName,
				expectedStatus:   http.StatusUnauthorized,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgUnauthorized),
			}),
			Entry("should return 403 for non-admin user (without namespace)", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          wskCMName,
				user:             "non-admin-user",
				expectedStatus:   http.StatusForbidden,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgForbidden),
			}),
			Entry("should return 403 for non-admin user (with namespace)", assetTestCase{
				assetType:        wskAssetTypeIcon,
				wskName:          wskCMName,
				namespace:        namespaceName,
				user:             "non-admin-user",
				expectedStatus:   http.StatusForbidden,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgForbidden),
			}),
		)

		DescribeTable("GetWorkspaceKindLogoHandler",
			func(tc assetTestCase) {
				assertAssetResponse(a.GetWorkspaceKindLogoHandler, &tc)
			},
			Entry("should return 200 for ConfigMap-based logo", assetTestCase{
				assetType:           wskAssetTypeLogo,
				wskName:             wskCMName,
				user:                adminUser,
				expectedStatus:      http.StatusOK,
				expectedContentType: constants.MediaTypeSVG,
				validateBodyFunc: func(body []byte) {
					Expect(body).To(BeEquivalentTo(svgContent))
				},
			}),
			Entry("should return 200 for ConfigMap-based logo with namespace query", assetTestCase{
				assetType:           wskAssetTypeLogo,
				wskName:             wskCMName,
				namespace:           namespaceName,
				user:                adminUser,
				expectedStatus:      http.StatusOK,
				expectedContentType: constants.MediaTypeSVG,
				validateBodyFunc: func(body []byte) {
					Expect(body).To(BeEquivalentTo(svgContent))
				},
			}),
			Entry("should return 404 for non-existent WorkspaceKind", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          "non-existent-wsk",
				user:             adminUser,
				expectedStatus:   http.StatusNotFound,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgNotFound),
			}),
			Entry("should return 404 for URL-based logo", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          wskURLName,
				user:             adminUser,
				expectedStatus:   http.StatusNotFound,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgNotFound),
			}),
			Entry("should return 422 for invalid workspace kind name", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          "INVALID!!!",
				user:             adminUser,
				expectedStatus:   http.StatusUnprocessableEntity,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgPathParamsInvalid),
			}),
			Entry("should return 422 for invalid namespace query parameter", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          wskCMName,
				namespace:        "INVALID!!!",
				user:             adminUser,
				expectedStatus:   http.StatusUnprocessableEntity,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgQueryParamsInvalid),
			}),
			Entry("should return 401 when no authentication is provided", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          wskCMName,
				expectedStatus:   http.StatusUnauthorized,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgUnauthorized),
			}),
			Entry("should return 403 for non-admin user (without namespace)", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          wskCMName,
				user:             "non-admin-user",
				expectedStatus:   http.StatusForbidden,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgForbidden),
			}),
			Entry("should return 403 for non-admin user (with namespace)", assetTestCase{
				assetType:        wskAssetTypeLogo,
				wskName:          wskCMName,
				namespace:        namespaceName,
				user:             "non-admin-user",
				expectedStatus:   http.StatusForbidden,
				validateBodyFunc: newErrorMessageValidationFunc(errMsgForbidden),
			}),
		)
	})
})
