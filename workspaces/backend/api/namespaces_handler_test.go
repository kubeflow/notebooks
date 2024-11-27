/*
 *
 * Copyright 2024.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/julienschmidt/httprouter"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
)

var _ = Describe("Namespaces Handler", func() {
	var (
		a          App
		testRouter *httprouter.Router
	)

	BeforeEach(func() {
		repos := repositories.NewRepositories(k8sClient)
		a = App{
			Config: config.EnvConfig{
				Port: 4000,
			},
			repositories: repos,
		}

		testRouter = httprouter.New()
		testRouter.GET("/api/namespaces", a.GetNamespacesHandler)
	})

	Context("when namespaces exist", func() {
		const namespaceName1 = "namespaceone"
		const namespaceName2 = "namespacetwo"

		BeforeEach(func() {
			By("creating namespaces")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			namespace2 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName2,
				},
			}
			Expect(k8sClient.Create(ctx, namespace2)).To(Succeed())

		})

		AfterEach(func() {
			By("deleting namespaces")
			By("deleting the namespace1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())

			By("deleting the namespace2")
			namespace2 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName2,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace2)).To(Succeed())
		})

		It("should retrieve all namespaces successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, "/api/namespaces", nil)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetNamespacesHandler")
			rr := httptest.NewRecorder()
			testRouter.ServeHTTP(rr, req)
			rs := rr.Result()
			defer rs.Body.Close() // nolint: errcheck

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), "Expected HTTP status 200 OK")

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred(), "Failed to read HTTP response body")

			By("unmarshalling the response JSON")
			var response NamespacesEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling response JSON")

			By("asserting that the created namespaces are in the response")
			Expect(response.Data).To(ContainElements(
				models.NamespaceModel{Name: namespaceName1},
				models.NamespaceModel{Name: namespaceName2},
			), "Expected created namespaces to be in the response")
		})
	})
})
