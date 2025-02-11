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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

var _ = Describe("Workspaces Handler", func() {

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing Workspaces", Serial, Ordered, func() {

		const namespaceName1 = "ws-exist-ns1"
		const namespaceName2 = "ws-exist-ns2"

		var (
			workspaceName1 string
			workspaceKey1  types.NamespacedName
			workspaceName2 string
			workspaceKey2  types.NamespacedName
			workspaceName3 string
			workspaceKey3  types.NamespacedName

			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-exist-test"
			workspaceName1 = fmt.Sprintf("workspace-1-%s", uniqueName)
			workspaceKey1 = types.NamespacedName{Name: workspaceName1, Namespace: namespaceName1}
			workspaceName2 = fmt.Sprintf("workspace-2-%s", uniqueName)
			workspaceKey2 = types.NamespacedName{Name: workspaceName2, Namespace: namespaceName1}
			workspaceName3 = fmt.Sprintf("workspace-3-%s", uniqueName)
			workspaceKey3 = types.NamespacedName{Name: workspaceName3, Namespace: namespaceName2}
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating Namespace 2")
			namespace2 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName2,
				},
			}
			Expect(k8sClient.Create(ctx, namespace2)).To(Succeed())

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating Workspace 1 in Namespace 1")
			workspace1 := NewExampleWorkspace(workspaceName1, namespaceName1, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace1)).To(Succeed())

			By("creating Workspace 2 in Namespace 1")
			workspace2 := NewExampleWorkspace(workspaceName2, namespaceName1, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace2)).To(Succeed())

			By("creating Workspace 3 in Namespace 2")
			workspace3 := NewExampleWorkspace(workspaceName3, namespaceName2, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace3)).To(Succeed())
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

			By("deleting Workspace 2 from Namespace 1")
			workspace2 := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName2,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace2)).To(Succeed())

			By("deleting Workspace 3 from Namespace 2")
			workspace3 := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName3,
					Namespace: namespaceName2,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace3)).To(Succeed())

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

			By("deleting Namespace 2")
			namespace2 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName2,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace2)).To(Succeed())
		})

		It("should retrieve Workspaces from all namespaces successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, AllWorkspacesPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspacesEnvelope")
			var response WorkspacesEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the WorkspaceKind from the Kubernetes API")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())

			By("getting the Workspaces from the Kubernetes API")
			workspace1 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace1)).To(Succeed())
			workspace2 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey2, workspace2)).To(Succeed())
			workspace3 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey3, workspace3)).To(Succeed())

			By("ensuring the response contains the expected Workspaces")
			Expect(response.Data).To(ConsistOf(
				models.NewWorkspaceModelFromWorkspace(workspace1, workspaceKind),
				models.NewWorkspaceModelFromWorkspace(workspace2, workspaceKind),
				models.NewWorkspaceModelFromWorkspace(workspace3, workspaceKind),
			))

			By("ensuring the response can be marshaled to JSON and back to []Workspace")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject []models.Workspace
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to []Workspace")
		})

		It("should retrieve Workspaces from Namespace 1 successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspacesEnvelope")
			var response WorkspacesEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the WorkspaceKind from the Kubernetes API")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())

			By("getting the Workspaces from the Kubernetes API")
			workspace1 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace1)).To(Succeed())
			workspace2 := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey2, workspace2)).To(Succeed())

			By("ensuring the response contains the expected Workspaces")
			Expect(response.Data).To(ConsistOf(
				models.NewWorkspaceModelFromWorkspace(workspace1, workspaceKind),
				models.NewWorkspaceModelFromWorkspace(workspace2, workspaceKind),
			))

			By("ensuring the response can be marshaled to JSON and back to []Workspace")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject []models.Workspace
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to []Workspace")
		})

		It("should retrieve a single Workspace successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+WorkspaceNamePathParam, workspaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: WorkspaceNamePathParam, Value: workspaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceEnvelope")
			var response WorkspaceEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the WorkspaceKind from the Kubernetes API")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())

			By("getting the Workspace from the Kubernetes API")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey1, workspace)).To(Succeed())

			By("ensuring the response matches the expected Workspace")
			Expect(response.Data).To(BeComparableTo(models.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)))

			By("ensuring the response can be marshaled to JSON and back to Workspace")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject models.Workspace
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to Workspace")
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing invalid Workspaces", Serial, Ordered, func() {

		const namespaceName1 = "ws-invalid-ns1"

		var (
			workspaceMissingWskName string
			workspaceMissingWskKey  types.NamespacedName

			workspaceInvalidPodConfig    string
			workspaceInvalidPodConfigKey types.NamespacedName

			workspaceInvalidImageConfig    string
			workspaceInvalidImageConfigKey types.NamespacedName

			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-invalid-test"
			workspaceMissingWskName = fmt.Sprintf("workspace-mising-wsk-%s", uniqueName)
			workspaceMissingWskKey = types.NamespacedName{Name: workspaceMissingWskName, Namespace: namespaceName1}
			workspaceInvalidPodConfig = fmt.Sprintf("workspace-invalid-pc-%s", uniqueName)
			workspaceInvalidPodConfigKey = types.NamespacedName{Name: workspaceInvalidPodConfig, Namespace: namespaceName1}
			workspaceInvalidImageConfig = fmt.Sprintf("workspace-invalid-ic-%s", uniqueName)
			workspaceInvalidImageConfigKey = types.NamespacedName{Name: workspaceInvalidImageConfig, Namespace: namespaceName1}
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

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

			By("creating Workspace with missing WorkspaceKind")
			workspaceMissingWsk := NewExampleWorkspace(workspaceMissingWskName, namespaceName1, "bad-wsk")
			Expect(k8sClient.Create(ctx, workspaceMissingWsk)).To(Succeed())

			By("creating Workspace with invalid PodConfig")
			workspaceInvalidPodConfig := NewExampleWorkspace(workspaceInvalidPodConfig, namespaceName1, workspaceKindName)
			workspaceInvalidPodConfig.Spec.PodTemplate.Options.PodConfig = "bad-pc"
			Expect(k8sClient.Create(ctx, workspaceInvalidPodConfig)).To(Succeed())

			By("creating Workspace with invalid ImageConfig")
			workspaceInvalidImageConfig := NewExampleWorkspace(workspaceInvalidImageConfig, namespaceName1, workspaceKindName)
			workspaceInvalidImageConfig.Spec.PodTemplate.Options.ImageConfig = "bad-ic"
			Expect(k8sClient.Create(ctx, workspaceInvalidImageConfig)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting Workspace with missing WorkspaceKind")
			workspaceMissingWsk := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceMissingWskName,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceMissingWsk)).To(Succeed())

			By("deleting Workspace with invalid PodConfig")
			workspaceInvalidPodConfig := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceInvalidPodConfig,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceInvalidPodConfig)).To(Succeed())

			By("deleting Workspace with invalid ImageConfig")
			workspaceInvalidImageConfig := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceInvalidImageConfig,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceInvalidImageConfig)).To(Succeed())

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

		It("should retrieve invalid Workspaces from Namespace 1 successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspacesEnvelope")
			var response WorkspacesEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the WorkspaceKind from the Kubernetes API")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())

			By("getting the Workspaces from the Kubernetes API")
			workspaceMissingWsk := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceMissingWskKey, workspaceMissingWsk)).To(Succeed())
			workspaceInvalidPodConfig := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceInvalidPodConfigKey, workspaceInvalidPodConfig)).To(Succeed())
			workspaceInvalidImageConfig := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceInvalidImageConfigKey, workspaceInvalidImageConfig)).To(Succeed())

			By("ensuring the model for Workspace with missing WorkspaceKind is as expected")
			workspaceMissingWskModel := models.NewWorkspaceModelFromWorkspace(workspaceMissingWsk, nil)
			Expect(workspaceMissingWskModel.WorkspaceKind.Missing).To(BeTrue())
			Expect(workspaceMissingWskModel.PodTemplate.Volumes.Home.MountPath).To(Equal(models.UnknownHomeMountPath))
			Expect(workspaceMissingWskModel.PodTemplate.Options.PodConfig.Current.DisplayName).To(Equal(models.UnknownPodConfig))
			Expect(workspaceMissingWskModel.PodTemplate.Options.PodConfig.Current.Description).To(Equal(models.UnknownPodConfig))
			Expect(workspaceMissingWskModel.PodTemplate.Options.ImageConfig.Current.DisplayName).To(Equal(models.UnknownImageConfig))
			Expect(workspaceMissingWskModel.PodTemplate.Options.ImageConfig.Current.Description).To(Equal(models.UnknownImageConfig))

			By("ensuring the model for Workspace with invalid PodConfig is as expected")
			workspaceInvalidPodConfigModel := models.NewWorkspaceModelFromWorkspace(workspaceInvalidPodConfig, workspaceKind)
			Expect(workspaceInvalidPodConfigModel.PodTemplate.Options.PodConfig.Current.DisplayName).To(Equal(models.UnknownPodConfig))
			Expect(workspaceInvalidPodConfigModel.PodTemplate.Options.PodConfig.Current.Description).To(Equal(models.UnknownPodConfig))

			By("ensuring the model for Workspace with invalid ImageConfig is as expected")
			workspaceInvalidImageConfigModel := models.NewWorkspaceModelFromWorkspace(workspaceInvalidImageConfig, workspaceKind)
			Expect(workspaceInvalidImageConfigModel.PodTemplate.Options.ImageConfig.Current.DisplayName).To(Equal(models.UnknownImageConfig))
			Expect(workspaceInvalidImageConfigModel.PodTemplate.Options.ImageConfig.Current.Description).To(Equal(models.UnknownImageConfig))

			By("ensuring the response contains the expected Workspaces")
			Expect(response.Data).To(ConsistOf(
				workspaceMissingWskModel,
				workspaceInvalidPodConfigModel,
				workspaceInvalidImageConfigModel,
			))
		})

		It("should retrieve a single invalid Workspace successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+WorkspaceNamePathParam, workspaceMissingWskName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: WorkspaceNamePathParam, Value: workspaceMissingWskName},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceEnvelope")
			var response WorkspaceEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the Workspace from the Kubernetes API")
			workspaceMissingWsk := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceMissingWskKey, workspaceMissingWsk)).To(Succeed())

			By("ensuring the response matches the expected Workspace")
			workspaceMissingWskModel := models.NewWorkspaceModelFromWorkspace(workspaceMissingWsk, nil)
			Expect(response.Data).To(BeComparableTo(workspaceMissingWskModel))
		})
	})

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing Workspaces", Serial, func() {

		It("should return an empty list of Workspaces for all namespaces", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, AllWorkspacesPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspacesEnvelope")
			var response WorkspacesEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that no Workspaces were returned")
			Expect(response.Data).To(BeEmpty())
		})

		It("should return an empty list of Workspaces for a non-existent namespace", func() {
			missingNamespace := "non-existent-namespace"

			By("creating the HTTP request")
			path := strings.Replace(AllWorkspacesPath, ":"+NamespacePathParam, missingNamespace, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspacesHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: missingNamespace},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspacesEnvelope")
			var response WorkspacesEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that no Workspaces were returned")
			Expect(response.Data).To(BeEmpty())
		})

		It("should return 404 for a non-existent Workspace", func() {
			missingNamespace := "non-existent-namespace"
			missingWorkspaceName := "non-existent-workspace"

			By("creating the HTTP request")
			path := strings.Replace(WorkspacesByNamePath, ":"+NamespacePathParam, missingNamespace, 1)
			path = strings.Replace(path, ":"+WorkspaceNamePathParam, missingWorkspaceName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: missingNamespace},
				httprouter.Param{Key: WorkspaceNamePathParam, Value: missingWorkspaceName},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound))
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       therefore, we run them using the `Ordered` Ginkgo decorator.
	Context("CRUD Workspaces", Ordered, func() {

		const namespaceNameCrud = "ws-crud-ns"

		var (
			workspaceName     string
			workspaceKey      types.NamespacedName
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-crud-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceNameCrud}
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the Namespace")
			namespaceA := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceNameCrud,
				},
			}
			Expect(k8sClient.Create(ctx, namespaceA)).To(Succeed())

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())

			By("deleting the Namespace")
			namespaceA := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceNameCrud,
				},
			}
			Expect(k8sClient.Delete(ctx, namespaceA)).To(Succeed())
		})

		It("should create and delete a Workspace successfully", func() {

			By("getting the WorkspaceKind from the Kubernetes API")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())

			By("defining the Workspace to create")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespaceNameCrud,
				},
				Spec: kubefloworgv1beta1.WorkspaceSpec{
					Kind:         workspaceKindName,
					Paused:       ptr.To(false),
					DeferUpdates: ptr.To(false),
					PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
						PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
							Labels: map[string]string{
								"app": "dora",
							},
							Annotations: map[string]string{
								"app": "dora",
							},
						},
						Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
							Home: ptr.To("my-home-pvc"),
							Data: []kubefloworgv1beta1.PodVolumeMount{
								{
									PVCName:   "my-data-pvc",
									MountPath: "/data",
									ReadOnly:  ptr.To(false),
								},
							},
						},
						Options: kubefloworgv1beta1.WorkspacePodOptions{
							ImageConfig: "jupyterlab_scipy_180",
							PodConfig:   "tiny_cpu",
						},
					},
				},
			}
			workspaceModel := models.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)

			By("marshaling the Workspace model to JSON")
			workspaceModelJSON, err := json.Marshal(workspaceModel)
			Expect(err).NotTo(HaveOccurred())

			By("creating an HTTP request to create the Workspace")
			path := strings.Replace(WorkspacesByNamespacePath, ":"+NamespacePathParam, namespaceNameCrud, 1)
			req, err := http.NewRequest(http.MethodPost, path, strings.NewReader(string(workspaceModelJSON)))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceHandler")
			rr := httptest.NewRecorder()
			ps := httprouter.Params{
				httprouter.Param{
					Key:   NamespacePathParam,
					Value: namespaceNameCrud,
				},
			}
			a.CreateWorkspaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusCreated))

			By("getting the created Workspace from the Kubernetes API")
			createdWorkspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, createdWorkspace)).To(Succeed())

			By("ensuring the created Workspace matches the expected Workspace")
			Expect(createdWorkspace.Spec).To(BeComparableTo(workspace.Spec))

			By("creating an HTTP request to delete the Workspace")
			path = strings.Replace(WorkspacesByNamePath, ":"+NamespacePathParam, namespaceNameCrud, 1)
			path = strings.Replace(path, ":"+WorkspaceNamePathParam, workspaceName, 1)
			req, err = http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteWorkspaceHandler")
			rr = httptest.NewRecorder()
			ps = httprouter.Params{
				httprouter.Param{
					Key:   NamespacePathParam,
					Value: namespaceNameCrud,
				},
				httprouter.Param{
					Key:   WorkspaceNamePathParam,
					Value: workspaceName,
				},
			}
			a.DeleteWorkspaceHandler(rr, req, ps)
			rs = rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNoContent))

			By("ensuring the Workspace has been deleted")
			deletedWorkspace := &kubefloworgv1beta1.Workspace{}
			err = k8sClient.Get(ctx, workspaceKey, deletedWorkspace)
			Expect(err).To(HaveOccurred())
			Expect(apierrors.IsNotFound(err)).To(BeTrue())
		})
	})
})
