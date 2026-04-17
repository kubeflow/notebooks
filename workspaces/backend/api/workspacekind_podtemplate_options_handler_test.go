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
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

var _ = Describe("WorkspaceKinds Handler", func() {

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing WorkspaceKinds", Serial, Ordered, func() {

		const namespaceName1 = "wsk-options-exist-test-ns1"

		var (
			workspaceKind1Name string
			workspaceKind1Key  types.NamespacedName
			workspaceKind2Name string
			// workspaceKind2Key  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "wsk-options-exist-test"
			workspaceKind1Name = fmt.Sprintf("workspacekind-1-%s", uniqueName)
			workspaceKind1Key = types.NamespacedName{Name: workspaceKind1Name}
			workspaceKind2Name = fmt.Sprintf("workspacekind-2-%s", uniqueName)
			// workspaceKind2Key = types.NamespacedName{Name: workspaceKind2Name}

			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating WorkspaceKind 1")
			workspaceKind1 := NewExampleWorkspaceKind(workspaceKind1Name)
			Expect(k8sClient.Create(ctx, workspaceKind1)).To(Succeed())

			By("creating WorkspaceKind 2")
			workspaceKind2 := NewExampleWorkspaceKind(workspaceKind2Name)
			Expect(k8sClient.Create(ctx, workspaceKind2)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting WorkspaceKind 1")
			workspaceKind1 := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKind1Name,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind1)).To(Succeed())

			By("deleting WorkspaceKind 2")
			workspaceKind2 := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKind2Name,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind2)).To(Succeed())

			By("deleting Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())
		})

		Context("when listing pod template options values", func() {
			var (
				listValuesPath string
				listValuesPs   httprouter.Params
			)

			BeforeEach(func() {
				listValuesPath = strings.Replace(PodTemplateOptionsListValuesPath, ":"+ResourceNamePathParam, workspaceKind1Name, 1)
				listValuesPs = httprouter.Params{
					httprouter.Param{Key: ResourceNamePathParam, Value: workspaceKind1Name},
				}
			})

			makeRequest := func(body string) (*httptest.ResponseRecorder, *http.Response) {
				req, err := http.NewRequest(http.MethodPost, listValuesPath, bytes.NewBufferString(body))
				Expect(err).NotTo(HaveOccurred())
				req.Header.Set(userIdHeader, adminUser)
				req.Header.Set("Content-Type", MediaTypeJson)
				rr := httptest.NewRecorder()
				a.PodTemplateOptionsListValuesHandler(rr, req, listValuesPs)
				return rr, rr.Result()
			}

			getExpected := func(listValuesContext models.ListValuesContext) *models.PodTemplateOptions {
				wsk := &kubefloworgv1beta1.WorkspaceKind{}
				Expect(k8sClient.Get(ctx, workspaceKind1Key, wsk)).To(Succeed())
				listValuesRequest := &models.ListValuesRequest{Context: listValuesContext}
				wskModel, err := models.NewPodTemplateOptionsModelFromWorkspaceKind(wsk, listValuesRequest)
				Expect(err).NotTo(HaveOccurred())
				return wskModel
			}

			It("should return all values when no options are specified", func() {
				By("creating the HTTP request with no context")
				rr, rs := makeRequest(`{"data":{}}`)
				defer rs.Body.Close()

				By("verifying the HTTP response status code")
				Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

				By("unmarshalling the response body")
				var response PodTemplateOptionsEnvelope
				Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())

				By("ensuring response contains all options")
				Expect(response.Data).To(BeComparableTo(getExpected(models.ListValuesContext{})))
			})

			It("should return all values when only context namespace is provided", func() {
				By("creating the HTTP request with only namespace in context")
				rr, rs := makeRequest(`{"data":{"context":{"namespace":{"name":"` + namespaceName1 + `"}}}}`)
				defer rs.Body.Close()

				By("verifying the HTTP response status code")
				Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

				By("unmarshalling the response body")
				var response PodTemplateOptionsEnvelope
				Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())

				By("ensuring response is unchanged (namespace does not filter options)")
				Expect(response.Data).To(BeComparableTo(getExpected(models.ListValuesContext{})))
			})

			It("should return only the matching image value when imageConfig id is provided", func() {
				By("creating the HTTP request with imageConfig id filter")
				rr, rs := makeRequest(`{"data":{"context":{"imageConfig":{"id":"jupyterlab_scipy_190"}}}}`)
				defer rs.Body.Close()

				By("verifying the HTTP response status code")
				Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

				By("unmarshalling the response body")
				var response PodTemplateOptionsEnvelope
				Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())

				By("ensuring response contains only the requested image option")
				expected := getExpected(models.ListValuesContext{
					ImageConfig: &models.ContextImageConfig{Id: "jupyterlab_scipy_190"},
				})
				Expect(response.Data).To(BeComparableTo(expected))
				Expect(response.Data.ImageConfig.Values).To(HaveLen(1))
			})

			It("should return only the matching pod value when podConfig id is provided", func() {
				By("creating the HTTP request with podConfig id filter")
				rr, rs := makeRequest(`{"data":{"context":{"podConfig":{"id":"tiny_cpu"}}}}`)
				defer rs.Body.Close()

				By("verifying the HTTP response status code")
				Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

				By("unmarshalling the response body")
				var response PodTemplateOptionsEnvelope
				Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())

				By("ensuring response contains only the requested pod option")
				expected := getExpected(models.ListValuesContext{
					PodConfig: &models.ContextPodConfig{Id: "tiny_cpu"},
				})
				Expect(response.Data).To(BeComparableTo(expected))
				Expect(response.Data.PodConfig.Values).To(HaveLen(1))
			})

			It("should return filtered image and pod values when all context options are provided", func() {
				By("creating the HTTP request with namespace, imageConfig and podConfig in context")
				rr, rs := makeRequest(`{"data":{"context":{"namespace":{"name":"` + namespaceName1 + `"},"imageConfig":{"id":"jupyterlab_scipy_190"},"podConfig":{"id":"tiny_cpu"}}}}`)
				defer rs.Body.Close()

				By("verifying the HTTP response status code")
				Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

				By("unmarshalling the response body")
				var response PodTemplateOptionsEnvelope
				Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())

				By("ensuring response contains only the requested image and pod options")
				expected := getExpected(models.ListValuesContext{
					Namespace:   &models.ContextNamespace{Name: namespaceName1},
					ImageConfig: &models.ContextImageConfig{Id: "jupyterlab_scipy_190"},
					PodConfig:   &models.ContextPodConfig{Id: "tiny_cpu"},
				})
				Expect(response.Data).To(BeComparableTo(expected))
				Expect(response.Data.ImageConfig.Values).To(HaveLen(1))
				Expect(response.Data.PodConfig.Values).To(HaveLen(1))
			})

			It("should return 422 when data is missing from the request body", func() {
				By("creating the HTTP request with no data field")
				rr, rs := makeRequest(`{}`)
				defer rs.Body.Close()

				By("verifying unprocessable entity status")
				Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
			})
		})
	})

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing WorkspaceKinds", Serial, func() {

		It("should return 404 for PodTemplateOptionsListValues on a non-existent WorkspaceKind", func() {
			missingWorkspaceKindName := "non-existent-workspacekind"

			By("creating the HTTP request")
			path := strings.Replace(PodTemplateOptionsListValuesPath, ":"+ResourceNamePathParam, missingWorkspaceKindName, 1)
			req, err := http.NewRequest(http.MethodPost, path, bytes.NewBufferString(`{"data":{}}`))
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers and Content-Type")
			req.Header.Set(userIdHeader, adminUser)
			req.Header.Set("Content-Type", MediaTypeJson)

			By("executing PodTemplateOptionsListValuesHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: missingWorkspaceKindName},
			}
			rr := httptest.NewRecorder()
			a.PodTemplateOptionsListValuesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})
})
