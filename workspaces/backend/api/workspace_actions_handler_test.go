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
	"k8s.io/utils/ptr"
)

var _ = Describe("Workspace Actions Handler", func() {

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing Workspaces", Serial, Ordered, func() {

		const namespaceName1 = "ws-ops-ns1"

		var (
			workspaceName1    string
			workspaceKey1     types.NamespacedName
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "ws-ops-test"
			workspaceName1 = fmt.Sprintf("workspace-1-%s", uniqueName)
			workspaceKey1 = types.NamespacedName{Name: workspaceName1, Namespace: namespaceName1}
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating Workspace 1 in Namespace 1")
			workspace1 := NewExampleWorkspace(workspaceName1, namespaceName1, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace1)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting Workspace 1 from Namespace 1")
			workspace1 := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace1)).To(Succeed())

			By("deleting WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())

			By("deleting Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())
		})

		It("should pause a workspace successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(PauseWorkspacePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, workspaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)
			req.Header.Set("Content-Type", "application/merge-patch+json")

			By("executing PauseWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: workspaceName1},
			}
			rr := httptest.NewRecorder()
			a.PauseWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the response contains the pause state")
			var response PauseStateEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Data).NotTo(BeNil())
			Expect(response.Data.Namespace).To(Equal(namespaceName1))
			Expect(response.Data.WorkspaceName).To(Equal(workspaceName1))
			Expect(response.Data.Paused).To(BeTrue())

			By("getting the Workspace from the Kubernetes API")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace)).To(Succeed())

			By("ensuring the workspace is paused")
			Expect(workspace.Spec.Paused).To(Equal(ptr.To(true)))
		})

		It("should start a workspace successfully", func() {
			By("setting the workspace's status state to Paused")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace)).To(Succeed())
			workspace.Status.State = kubefloworgv1beta1.WorkspaceStatePaused
			Expect(k8sClient.Status().Update(ctx, workspace)).To(Succeed())

			By("creating the HTTP request")
			path := strings.Replace(StartWorkspacePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, workspaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)
			req.Header.Set("Content-Type", "application/merge-patch+json")

			By("executing StartWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: workspaceName1},
			}
			rr := httptest.NewRecorder()
			a.StartWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the response contains the pause state")
			var response PauseStateEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())
			Expect(response.Data).NotTo(BeNil())
			Expect(response.Data.Namespace).To(Equal(namespaceName1))
			Expect(response.Data.WorkspaceName).To(Equal(workspaceName1))
			Expect(response.Data.Paused).To(BeFalse())

			By("getting the Workspace from the Kubernetes API")
			workspace = &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace)).To(Succeed())

			By("ensuring the workspace is not paused")
			Expect(workspace.Spec.Paused).To(Equal(ptr.To(false)))
		})

		It("should return 404 for a non-existent workspace when starting", func() {
			missingWorkspaceName := "non-existent-workspace"

			By("creating the HTTP request")
			path := strings.Replace(StartWorkspacePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, missingWorkspaceName, 1)
			req, err := http.NewRequest(http.MethodPost, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing StartWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: missingWorkspaceName},
			}
			rr := httptest.NewRecorder()
			a.StartWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 404 for a non-existent workspace", func() {
			missingWorkspaceName := "non-existent-workspace"

			By("creating the HTTP request")
			path := strings.Replace(PauseWorkspacePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, missingWorkspaceName, 1)
			req, err := http.NewRequest(http.MethodPost, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing PauseWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: missingWorkspaceName},
			}
			rr := httptest.NewRecorder()
			a.PauseWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 when starting a workspace that is not in Paused state", func() {
			By("setting the workspace's status state to Unknown and spec.paused to false")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace)).To(Succeed())
			workspace.Spec.Paused = ptr.To(false)
			workspace.Status.State = kubefloworgv1beta1.WorkspaceStateUnknown
			Expect(k8sClient.Update(ctx, workspace)).To(Succeed())
			Expect(k8sClient.Status().Update(ctx, workspace)).To(Succeed())

			By("creating the HTTP request")
			path := strings.Replace(StartWorkspacePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, workspaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)
			req.Header.Set("Content-Type", "application/merge-patch+json")

			By("executing StartWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: workspaceName1},
			}
			rr := httptest.NewRecorder()
			a.StartWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code is 422")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 when pausing a workspace that is already paused", func() {
			By("setting the workspace's spec.paused to true")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace)).To(Succeed())
			workspace.Spec.Paused = ptr.To(true)
			Expect(k8sClient.Update(ctx, workspace)).To(Succeed())

			By("creating the HTTP request")
			path := strings.Replace(PauseWorkspacePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, workspaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)
			req.Header.Set("Content-Type", "application/merge-patch+json")

			By("executing PauseWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: workspaceName1},
			}
			rr := httptest.NewRecorder()
			a.PauseWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code is 422")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})
})
