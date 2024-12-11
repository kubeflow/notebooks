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
	"math/rand"
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

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
)

var _ = Describe("WorkspaceKinds Handler", func() {
	Context("with existing workspacekinds", Ordered, func() {

		const namespaceName1 = "namespace-kind"

		var (
			a                  App
			workspaceKind1Name string
			workspaceKind2Name string
			workspaceKind1Key  types.NamespacedName
			workspaceKind2Key  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "wskind-update-test"
			workspaceKind1Name = fmt.Sprintf("workspacekind1-%s", uniqueName)
			workspaceKind1Key = types.NamespacedName{Name: workspaceKind1Name}
			workspaceKind2Name = fmt.Sprintf("workspacekind2-%s", uniqueName)
			workspaceKind2Key = types.NamespacedName{Name: workspaceKind2Name}

			repos := repositories.NewRepositories(k8sClient)
			a = App{
				Config: config.EnvConfig{
					Port: 4000,
				},
				repositories: repos,
			}

			By("creating namespaces")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating a WorkspaceKind1")
			workspaceKind1 := NewExampleWorkspaceKind(workspaceKind1Name)
			Expect(k8sClient.Create(ctx, workspaceKind1)).To(Succeed())

			By("creating a WorkspaceKind1")
			workspaceKind2 := NewExampleWorkspaceKind(workspaceKind2Name)
			Expect(k8sClient.Create(ctx, workspaceKind2)).To(Succeed())

		})

		AfterAll(func() {

			By("deleting the WorkspaceKind1")
			workspaceKind1 := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKind1Name,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind1)).To(Succeed())

			By("deleting the WorkspaceKind2")
			workspaceKind2 := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKind2Name,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind2)).To(Succeed())

			By("deleting the namespace1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())

		})

		It("should retrieve the all workspacekinds successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, WorkspacesByNamespacePath, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspaceKindsHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), "Expected HTTP status 200 OK")

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred(), "Failed to read HTTP response body")

			By("unmarshalling the response JSON")
			var response WorkspaceKindsEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling response JSON")

			By("retrieving workspaceKindsData in the response")
			workspaceKindsData := response.Data

			By("converting workspaceKindsData to JSON and back to []WorkspaceKindsModel")
			workspaceKindsJSON, err := json.Marshal(workspaceKindsData)
			Expect(err).NotTo(HaveOccurred(), "Error marshaling workspaces repositories")

			var workspaceKinds []models.WorkspaceKindModel
			err = json.Unmarshal(workspaceKindsJSON, &workspaceKinds)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling workspaces JSON")

			By("asserting that the retrieved workspaces kinds match the expected workspacekinds")
			workspacekind1 := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKind1Key, workspacekind1)).To(Succeed())
			workspacekind2 := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKind2Key, workspacekind2)).To(Succeed())

			expectedWorkspaceKinds := []models.WorkspaceKindModel{
				models.NewWorkspaceKindModelFromWorkspaceKind(workspacekind1),
				models.NewWorkspaceKindModelFromWorkspaceKind(workspacekind2),
			}
			Expect(workspaceKinds).To(ConsistOf(expectedWorkspaceKinds))
		})

		It("should retrieve a single workspacekind successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":name", workspaceKind1Name, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: "name", Value: workspaceKind1Name},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), "Expected HTTP status 200 OK")

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred(), "Failed to read HTTP response body")

			By("unmarshalling the response JSON")
			var response WorkspaceKindEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling response JSON")

			By("retrieving workspaceKindData in the response")
			workspaceKindData := response.Data

			By("comparing the retrieved workspacekind with the expected")
			workspacekind1 := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKind1Key, workspacekind1)).To(Succeed())

			expectedWorkspaceKind := models.NewWorkspaceKindModelFromWorkspaceKind(workspacekind1)
			Expect(workspaceKindData).To(Equal(expectedWorkspaceKind))
		})

	})

	Context("when there are no workspacekinds ", func() {

		var a App

		BeforeEach(func() {
			repos := repositories.NewRepositories(k8sClient)
			a = App{
				Config: config.EnvConfig{
					Port: 4000,
				},
				repositories: repos,
			}
		})
		It("should return an empty list of workspacekinds", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, AllWorkspaceKindsPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), "Expected HTTP status 200 OK")

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred(), "Failed to read HTTP response body")

			By("unmarshalling the response JSON")
			var response WorkspaceKindsEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling response JSON")

			By("asserting that the 'workspaces' list is empty")
			workspaceskindsJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "Error marshaling workspaces data")

			var workspaceKinds []models.WorkspaceKindModel
			err = json.Unmarshal(workspaceskindsJSON, &workspaceKinds)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling workspaces JSON")
			Expect(workspaceKinds).To(BeEmpty(), "Expected no workspaces in the response")
		})

		It("should return 404 for a non-existent workspacekind", func() {
			By("creating the HTTP request for a non-existent workspacekind")
			path := strings.Replace(WorkspaceKindsByNamePath, ":name", "non-existent-workspacekind", 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: "name", Value: "non-existent-workspacekind"},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), "Expected HTTP status 404 Not Found")
		})
	})

	Context("with unsupported request parameters", Ordered, func() {

		var (
			a                  App
			validAsciiName     string
			invalidAsciiName   string
			validMaxLengthName string
			invalidLengthName  string
		)

		// generateASCII generates a random ASCII string of the specified length.
		generateASCII := func(length int) string {
			const asciiChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

			var sb strings.Builder
			for i := 0; i < length; i++ {
				sb.WriteByte(asciiChars[rand.Intn(len(asciiChars))])
			}
			return sb.String()
		}

		BeforeAll(func() {
			validAsciiName = "test"
			invalidAsciiName = validAsciiName + string(rune(rand.Intn(0x10FFFF-128)+128))
			validMaxLengthName = generateASCII(255)
			invalidLengthName = generateASCII(256)

			repos := repositories.NewRepositories(k8sClient)
			a = App{
				Config: config.EnvConfig{
					Port: 4000,
				},
				repositories: repos,
			}
		})

		It("should return 400 status code for a non-ascii workspace", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamespacePath, ":"+WorkspaceNamePathParam, invalidAsciiName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{
					Key:   WorkspaceNamePathParam,
					Value: invalidAsciiName,
				},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), "Expected HTTP status 400 Bad Request")
		})

		It("should return 400 status code for a workspace longer than 255", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamespacePath, ":"+WorkspaceNamePathParam, invalidLengthName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{
					Key:   WorkspaceNamePathParam,
					Value: invalidLengthName,
				},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), "Expected HTTP status 400 Bad Request")

		})

		It("should return 200 status code for a workspace with a length of 255 characters", func() {
			By("creating the HTTP request")
			fmt.Println("Here Should except 255 length params")
			path := strings.Replace(WorkspacesByNamespacePath, ":"+WorkspaceNamePathParam, validMaxLengthName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{
					Key:   WorkspaceNamePathParam,
					Value: validMaxLengthName,
				},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), "Expected HTTP status 404 Not Found")
		})
	})
})
