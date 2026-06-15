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

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	modelsDetails "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/details"
)

var _ = Describe("Workspace PodTemplate Details Handler", func() {
	Context("with existing Workspace", Serial, Ordered, func() {
		const namespaceName = "details-happy-ns"
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "details-happy-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating the WorkspaceKind")
			wsk := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, wsk)).To(Succeed())

			By("creating the Workspace")
			ws := NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, ws)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			ws := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			Expect(k8sClient.Delete(ctx, ws)).To(Succeed())

			By("deleting the WorkspaceKind")
			wsk := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			Expect(k8sClient.Delete(ctx, wsk)).To(Succeed())

			By("deleting the Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should successfully return workspace details", func() {
			By("creating the HTTP request")
			path := strings.Replace(constants.WorkspacePodTemplateDetailsPath, ":"+constants.NamespacePathParam, namespaceName, 1)
			path = strings.Replace(path, ":"+constants.ResourceNamePathParam, workspaceName, 1)

			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacePodTemplateDetailsHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.NamespacePathParam, Value: namespaceName},
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: workspaceName},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateDetailsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 200 OK")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("verifying response structure")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			var response WorkspaceDetailsEnvelope
			Expect(json.Unmarshal(body, &response)).To(Succeed())

			wsCRD := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, wsCRD)).To(Succeed())

			wskCRD := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, wskCRD)).To(Succeed())

			expected := modelsDetails.NewWorkspaceDetailsFromWorkspace(wsCRD, wskCRD)
			if len(expected.Volumes.Secrets) == 0 {
				expected.Volumes.Secrets = nil
			}
			Expect(response.Data).To(BeComparableTo(&expected))

		})
	})

	Context("when querying workspace podtemplate details errors", func() {
		const testNamespace = "ns-details-test"
		const testWorkspace = "my-workspace"

		It("should return 404 when workspace does not exist", func() {
			path := strings.Replace(constants.WorkspacePodTemplateDetailsPath, ":"+constants.NamespacePathParam, testNamespace, 1)
			path = strings.Replace(path, ":"+constants.ResourceNamePathParam, testWorkspace, 1)

			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			ps := httprouter.Params{
				httprouter.Param{Key: constants.NamespacePathParam, Value: testNamespace},
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: testWorkspace},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateDetailsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusNotFound))
		})

		It("should return 422 for invalid parameters", func() {
			invalidNamespace := "INVALID!!!"

			path := strings.Replace(constants.WorkspacePodTemplateDetailsPath, ":"+constants.NamespacePathParam, invalidNamespace, 1)
			path = strings.Replace(path, ":"+constants.ResourceNamePathParam, testWorkspace, 1)

			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			ps := httprouter.Params{
				httprouter.Param{Key: constants.NamespacePathParam, Value: invalidNamespace},
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: testWorkspace},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateDetailsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))
		})
	})
})
