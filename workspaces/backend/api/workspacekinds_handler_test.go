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
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceKindListEnvelope")
			var response WorkspaceKindListEnvelope
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
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, workspaceKind1Name, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: workspaceKind1Name},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

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
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to WorkspaceKindListEnvelope")
			var response WorkspaceKindListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that no WorkspaceKinds were returned")
			Expect(response.Data).To(BeEmpty())
		})

		It("should return 404 for a non-existent WorkspaceKind", func() {
			missingWorkspaceKindName := "non-existent-workspacekind"

			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, missingWorkspaceKindName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: missingWorkspaceKindName},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	// NOTE: these tests create and delete resources on the cluster, so cannot be run in parallel.
	//       therefore, we run them using the `Serial` Ginkgo decorator.
	Context("when creating a WorkspaceKind", Serial, func() {

		var newWorkspaceKindName = "wsk-create-test"
		var validYAML []byte

		BeforeEach(func() {
			validYAML = []byte(fmt.Sprintf(`
apiVersion: workspaces.kubeflow.org/v1beta1
kind: WorkspaceKind
metadata:
  name: %s
spec:
  spawner:
    displayName: "Test Jupyter Environment"
    description: "A valid description for testing."
    icon:
      url: "https://example.com/icon.png"
    logo:
      url: "https://example.com/logo.svg"
  podTemplate:
    options:
      imageConfig:
        spawner:
          default: "default-image"
        values:
        - id: "default-image"
          name: "Jupyter Scipy"
          path: "kubeflownotebooks/jupyter-scipy:v1.9.0"
          spawner:
            displayName: "Jupyter with SciPy v1.9.0"
          spec:
            image: "kubeflownotebooks/jupyter-scipy:v1.9.0"
            ports:
            - id: "notebook-port"
              displayName: "Notebook Port"
              port: 8888
              protocol: "HTTP"
      podConfig:
        spawner:
          default: "default-pod-config"
        values:
        - id: "default-pod-config"
          name: "Default Resources"
          spawner:
            displayName: "Small CPU/RAM"
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "1"
              memory: "2Gi"
    volumeMounts:
      home: "/home/jovyan"
`, newWorkspaceKindName))
		})

		AfterEach(func() {
			By("cleaning up the created WorkspaceKind")
			wsk := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: newWorkspaceKindName,
				},
			}
			_ = k8sClient.Delete(ctx, wsk)
		})

		It("should succeed when creating a new WorkspaceKind with valid YAML", func() {
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req.Header.Set(userIdHeader, adminUser)

			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusCreated), "Body: %s", rr.Body.String())

			By("verifying the resource was created in the cluster")
			createdWsk := &kubefloworgv1beta1.WorkspaceKind{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: newWorkspaceKindName}, createdWsk)
			Expect(err).NotTo(HaveOccurred())
		})

		It("should fail with 400 Bad Request if the YAML is missing a required name", func() {
			missingNameYAML := []byte(`
apiVersion: workspaces.kubeflow.org/v1beta1
kind: WorkspaceKind
metadata: {}
spec:
  spawner:
    displayName: "This will fail"`)
			req, _ := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(missingNameYAML))
			req.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req.Header.Set(userIdHeader, adminUser)

			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})

			Expect(rr.Code).To(Equal(http.StatusBadRequest))
			Expect(rr.Body.String()).To(ContainSubstring("'.metadata.name' is a required field"))
		})

		It("should return a 409 Conflict when creating a WorkspaceKind that already exists", func() {
			By("creating the resource once successfully")
			req1, _ := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			req1.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req1.Header.Set(userIdHeader, adminUser)
			rr1 := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr1, req1, httprouter.Params{})
			Expect(rr1.Code).To(Equal(http.StatusCreated))

			By("attempting to create the exact same resource a second time")
			req2, _ := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			req2.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req2.Header.Set(userIdHeader, adminUser)
			rr2 := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr2, req2, httprouter.Params{})

			Expect(rr2.Code).To(Equal(http.StatusConflict))
		})

		It("should fail with 400 Bad Request when the YAML has the wrong kind", func() {
			wrongKindYAML := []byte(`apiVersion: v1
kind: Pod
metadata:
  name: i-am-the-wrong-kind`)
			req, _ := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(wrongKindYAML))
			req.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req.Header.Set(userIdHeader, adminUser)

			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})

			Expect(rr.Code).To(Equal(http.StatusBadRequest))
			Expect(rr.Body.String()).To(ContainSubstring("invalid kind in YAML: expected 'WorkspaceKind', got 'Pod'"))
		})

		It("should fail when the body is not valid YAML", func() {
			notYAML := []byte(`this is not yaml {`)
			req, _ := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(notYAML))
			req.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req.Header.Set(userIdHeader, adminUser)

			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})

			By("verifying the handler returns a 400 Bad Request with a valid error envelope")
			Expect(rr.Code).To(Equal(http.StatusBadRequest))
			var response ErrorEnvelope
			err := json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred(), "The error response should be valid JSON")
			Expect(response.Error.Message).To(Equal("request body is not a valid YAML manifest"))
		})
		It("should fail with 400 Bad Request for an empty YAML object", func() {
			By("defining an empty YAML object as the payload")
			invalidYAML := []byte("{}")

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(invalidYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", ContentTypeYAMLManifest)
			req.Header.Set(userIdHeader, adminUser)

			By("executing the CreateWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the handler returns a 400 Bad Request")
			// First, check the status code
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest))

			By("verifying the error message in the response body")
			// Second, read the body from the response stream
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred()) // Ensure reading the body didn't cause an error

			// Finally, assert on the content of the body
			Expect(string(body)).To(ContainSubstring("invalid kind in YAML: expected 'WorkspaceKind', got ''"))
		})
	})
})
