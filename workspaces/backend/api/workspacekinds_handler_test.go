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
	"fmt"
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
	"k8s.io/apimachinery/pkg/types"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
)

var _ = Describe("WorkspaceKinds Handler", func() {

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing WorkspaceKinds", Serial, Ordered, func() {

		const namespaceName1 = "wsk-exist-test-ns1"

		var (
			workspaceKind1Name string
			workspaceKind1Key  types.NamespacedName
			workspaceKind2Name string
			workspaceKind2Key  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "wsk-exist-test"
			workspaceKind1Name = fmt.Sprintf("workspacekind-1-%s", uniqueName)
			workspaceKind1Key = types.NamespacedName{Name: workspaceKind1Name}
			workspaceKind2Name = fmt.Sprintf("workspacekind-2-%s", uniqueName)
			workspaceKind2Key = types.NamespacedName{Name: workspaceKind2Name}

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

		It("should retrieve the all WorkspaceKinds successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, AllWorkspaceKindsPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindsHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceKindsEnvelope")
			var response WorkspaceKindsEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the WorkspaceKinds from the Kubernetes API")
			workspacekind1 := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKind1Key, workspacekind1)).To(Succeed())
			workspacekind2 := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKind2Key, workspacekind2)).To(Succeed())

			By("ensuring the response contains the expected WorkspaceKinds")
			Expect(response.Data).To(ConsistOf(
				models.NewWorkspaceKindModelFromWorkspaceKind(workspacekind1),
				models.NewWorkspaceKindModelFromWorkspaceKind(workspacekind2),
			))

			By("ensuring the wrapped data can be marshaled to JSON and back to []WorkspaceKind")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject []models.WorkspaceKind
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to []WorkspaceKind")
		})

		It("should retrieve a single WorkspaceKind successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+WorkspaceKindNamePathParam, workspaceKind1Name, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: WorkspaceKindNamePathParam, Value: workspaceKind1Name},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceKindEnvelope")
			var response WorkspaceKindEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the WorkspaceKind from the Kubernetes API")
			workspacekind1 := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKind1Key, workspacekind1)).To(Succeed())

			By("ensuring the response matches the expected WorkspaceKind")
			expectedWorkspaceKind := models.NewWorkspaceKindModelFromWorkspaceKind(workspacekind1)
			Expect(response.Data).To(BeComparableTo(expectedWorkspaceKind))

			By("ensuring the wrapped data can be marshaled to JSON and back")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject models.WorkspaceKind
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to WorkspaceKind")
		})
	})

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing WorkspaceKinds", Serial, func() {

		It("should return an empty list of WorkspaceKinds", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, AllWorkspaceKindsPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceKindsEnvelope")
			var response WorkspaceKindsEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that no WorkspaceKinds were returned")
			Expect(response.Data).To(BeEmpty())
		})

		It("should return 404 for a non-existent WorkspaceKind", func() {
			missingWorkspaceKindName := "non-existent-workspacekind"

			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+WorkspaceNamePathParam, missingWorkspaceKindName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: WorkspaceNamePathParam, Value: missingWorkspaceKindName},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound))
		})
	})
})
