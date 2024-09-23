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
	"github.com/julienschmidt/httprouter"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"io"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"net/http"
	"net/http/httptest"
	"strings"
)

var _ = Describe("Workspaces Handler", func() {
	Context("with existing workspaces", Serial, Ordered, func() {

		const namespaceName = "default"

		var (
			a                 App
			workspaceName1    string
			workspaceKey1     types.NamespacedName
			workspaceName2    string
			workspaceKey2     types.NamespacedName
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "wsk-update-test"
			workspaceName1 = fmt.Sprintf("workspace1-%s", uniqueName)
			workspaceName2 = fmt.Sprintf("workspace2-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

			repos := repositories.NewRepositories(k8sClient)
			a = App{
				Config: config.EnvConfig{
					Port: 4000,
				},
				repositories: repos,
			}

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace1")
			workspace1 := NewExampleWorkspace(workspaceName1, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace1)).To(Succeed())
			workspaceKey1 = types.NamespacedName{Name: workspaceName1, Namespace: namespaceName}

			By("creating the Workspace2")
			workspace2 := NewExampleWorkspace(workspaceName2, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace2)).To(Succeed())
			workspaceKey2 = types.NamespacedName{Name: workspaceName2, Namespace: namespaceName}
		})

		AfterAll(func() {
			By("deleting the Workspace1")
			workspace1 := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName1,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace1)).To(Succeed())

			By("deleting the Workspace2")
			workspace2 := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName2,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace2)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should retrieve the workspaces successfully", func() {

			By("creating the HTTP request")
			path := strings.Replace(WorkspacesPath, ":"+NamespacePathParam, namespaceName, 1)
			req, err := http.NewRequest(http.MethodGet, path, nil)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{
				httprouter.Param{
					Key:   NamespacePathParam,
					Value: namespaceName,
				},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), "Expected HTTP status 200 OK")

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred(), "Failed to read HTTP response body")

			By("unmarshalling the response JSON")
			var response Envelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling response JSON")

			By("checking if 'workspaces' key exists in the response")
			workspacesData, ok := response["workspaces"]
			Expect(ok).To(BeTrue(), "Response does not contain 'workspaces' key")

			By("converting workspacesData to JSON and back to []WorkspaceModel")
			workspacesJSON, err := json.Marshal(workspacesData)
			Expect(err).NotTo(HaveOccurred(), "Error marshalling workspaces repositories")

			var workspaces []models.WorkspaceModel
			err = json.Unmarshal(workspacesJSON, &workspaces)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling workspaces JSON")

			By("asserting that the retrieved workspaces match the expected workspaces")
			workspace1 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace1)).To(Succeed())
			workspace2 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey2, workspace2)).To(Succeed())

			expectedWorkspaces := []models.WorkspaceModel{
				models.NewWorkspaceModelFromWorkspace(workspace1),
				models.NewWorkspaceModelFromWorkspace(workspace2),
			}
			Expect(workspaces).To(ConsistOf(expectedWorkspaces))

		})

	})

	Context("when there are no workspaces", func() {
		const namespace = "default"
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

		It("should return an empty list of workspaces", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesPath, ":"+NamespacePathParam, namespace, 1)
			req, err := http.NewRequest(http.MethodGet, path, nil)
			Expect(err).NotTo(HaveOccurred(), "Failed to create HTTP request")

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{
				httprouter.Param{
					Key:   NamespacePathParam,
					Value: namespace,
				},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), "Expected HTTP status 200 OK")

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred(), "Failed to read HTTP response body")

			By("unmarshalling the response JSON")
			var response Envelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling response JSON")

			By("checking if 'workspaces' key exists in the response")
			workspacesData, ok := response["workspaces"]
			Expect(ok).To(BeTrue(), "Response does not contain 'workspaces' key")

			By("asserting that the 'workspaces' list is empty")
			workspacesJSON, err := json.Marshal(workspacesData)
			Expect(err).NotTo(HaveOccurred(), "Error marshalling workspaces data")

			var workspaces []models.WorkspaceModel
			err = json.Unmarshal(workspacesJSON, &workspaces)
			Expect(err).NotTo(HaveOccurred(), "Error unmarshalling workspaces JSON")
			Expect(workspaces).To(BeEmpty(), "Expected no workspaces in the response")
		})
	})
})
