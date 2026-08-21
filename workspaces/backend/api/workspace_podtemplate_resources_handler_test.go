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

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	commonModels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/metrics"
)

var _ = Describe("Workspace PodTemplate Resources Handler", func() {
	Context("with existing Workspace", Serial, Ordered, func() {
		const namespaceName = "resources-happy-ns"
		var (
			workspaceName     string
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "resources-happy-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

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

		It("should degrade gracefully with 200 OK returning configured resources when metrics are unavailable", func() {
			By("creating a workspace pod with configured resources")
			podName := fmt.Sprintf("pod-%s", workspaceName)
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      podName,
					Namespace: namespaceName,
					Labels: map[string]string{
						commonModels.LabelWorkspaceName: workspaceName,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "main",
							Image: "registry.example.com/image:v1",
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pod)).To(Succeed())
			defer func() {
				_ = k8sClient.Delete(ctx, pod)
			}()

			By("executing GetWorkspacePodTemplateResourcesHandler")
			rs := doPodTemplateResourcesRequest(namespaceName, workspaceName)
			defer rs.Body.Close()

			By("verifying status is 200 OK")
			// envtest has no Metrics Server, so live metrics are omitted.
			// The endpoint must still return 200 OK with the configured resources from the pod spec.
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("verifying the response contains configured resources with omitted metrics")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			var response WorkspaceResourceUsageEnvelope
			Expect(json.Unmarshal(body, &response)).To(Succeed())
			Expect(response.Data).NotTo(BeNil())
			Expect(response.Data.Containers).To(HaveKey("main"))
			Expect(response.Data.Containers["main"].MetricsFromMetricsServer).To(BeNil())
		})

		It("should return 400 Bad Request when workspace pod is not running", func() {
			By("executing GetWorkspacePodTemplateResourcesHandler when workspace has no pods")
			rs := doPodTemplateResourcesRequest(namespaceName, workspaceName)
			defer rs.Body.Close()

			By("verifying status is 400 Bad Request")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest))

			By("verifying the response is wrapped in the error envelope")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			var response ErrorEnvelope
			Expect(json.Unmarshal(body, &response)).To(Succeed())
			Expect(response.Error).NotTo(BeNil())
			Expect(response.Error.Code).To(Equal("400"))
			Expect(response.Error.Message).To(Equal(repository.ErrWorkspaceNotRunning.Error()))
		})
	})

	Context("when querying workspace podtemplate resources errors", func() {
		const testNamespace = "ns-resources-test"
		const testWorkspace = "my-workspace"

		It("should return 404 when workspace does not exist", func() {
			// The metrics repository resolves pods by label, so without an existence check a
			// missing workspace would degrade to WORKSPACE_NOT_RUNNING instead of a 404.
			rs := doPodTemplateResourcesRequest(testNamespace, testWorkspace)
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusNotFound))
		})

		It("should return 422 for invalid parameters", func() {
			rs := doPodTemplateResourcesRequest("INVALID!!!", testWorkspace)
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))
		})
	})
})

func doPodTemplateResourcesRequest(namespace, workspace string) *http.Response {
	req, err := http.NewRequest(http.MethodGet, resourcesPathFor(namespace, workspace), http.NoBody)
	Expect(err).NotTo(HaveOccurred())
	req.Header.Set(userIdHeader, adminUser)

	ps := httprouter.Params{
		httprouter.Param{Key: constants.NamespacePathParam, Value: namespace},
		httprouter.Param{Key: constants.ResourceNamePathParam, Value: workspace},
	}
	rr := httptest.NewRecorder()
	a.GetWorkspacePodTemplateResourcesHandler(rr, req, ps)
	return rr.Result()
}

func resourcesPathFor(namespace, workspace string) string {
	path := strings.Replace(constants.WorkspacePodTemplateResourcesPath, ":"+constants.NamespacePathParam, namespace, 1)
	return strings.Replace(path, ":"+constants.ResourceNamePathParam, workspace, 1)
}
