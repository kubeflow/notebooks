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
	"k8s.io/apimachinery/pkg/util/validation/field"

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

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing WorkspaceKinds", Serial, func() {

		It("should return an empty list of WorkspaceKinds", func() {
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
apiVersion: kubeflow.org/v1beta1
kind: WorkspaceKind
metadata:
  name: %s
spec:
  spawner:
    displayName: "JupyterLab Notebook"
    description: "A Workspace which runs JupyterLab in a Pod"
    icon:
      url: "https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png"
    logo:
      url: "https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg"
  podTemplate:
    serviceAccount:
      name: "default-editor"
    volumeMounts:
      home: "/home/jovyan"
    ports:
      - id: "jupyterlab"
        defaultDisplayName: "JupyterLab"
        protocol: "HTTP"
    options:
      imageConfig:
        spawner:
          default: "jupyterlab_scipy_190"
        values:
          - id: "jupyterlab_scipy_190"
            spawner:
              displayName: "jupyter-scipy:v1.9.0"
              description: "JupyterLab, with SciPy Packages"
            spec:
              image: "ghcr.io/kubeflow/kubeflow/notebook-servers/jupyter-scipy:v1.9.0"
              imagePullPolicy: "IfNotPresent"
              ports:
                - id: "jupyterlab"
                  displayName: "JupyterLab"
                  port: 8888
      podConfig:
        spawner:
          default: "tiny_cpu"
        values:
          - id: "tiny_cpu"
            spawner:
              displayName: "Tiny CPU"
              description: "Pod with 0.1 CPU, 128 Mb RAM"
            spec:
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi
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

		It("should succeed when creating a WorkspaceKind with valid YAML", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusCreated), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the resource was created in the cluster")
			createdWsk := &kubefloworgv1beta1.WorkspaceKind{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: newWorkspaceKindName}, createdWsk)
			Expect(err).NotTo(HaveOccurred())
		})

		It("should fail to create a WorkspaceKind with no name in the YAML", func() {
			missingNameYAML := []byte(`
apiVersion: kubeflow.org/v1beta1
kind: WorkspaceKind
metadata: {}
spec:
  spawner:
    displayName: "This will fail"`)

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(missingNameYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("decoding the error response")
			var response ErrorEnvelope
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the error message indicates a validation failure")
			Expect(response.Error.Cause.ValidationErrors).To(BeComparableTo(
				[]ValidationError{
					{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeRequired,
						Field:   "metadata.name",
						Message: field.ErrorTypeRequired.String(),
					},
				},
			))
		})

		It("should fail to create a WorkspaceKind that already exists", func() {
			By("creating the HTTP request")
			req1, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req1.Header.Set("Content-Type", MediaTypeYaml)
			req1.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler for the first time")
			rr1 := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr1, req1, httprouter.Params{})
			rs1 := rr1.Result()
			defer rs1.Body.Close()

			By("verifying the HTTP response status code for the first request")
			Expect(rs1.StatusCode).To(Equal(http.StatusCreated), descUnexpectedHTTPStatus, rr1.Body.String())

			By("creating a second HTTP request")
			req2, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req2.Header.Set("Content-Type", MediaTypeYaml)
			req2.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler for the second time")
			rr2 := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr2, req2, httprouter.Params{})
			rs2 := rr2.Result()
			defer rs2.Body.Close()

			By("verifying the HTTP response status code for the second request")
			Expect(rs2.StatusCode).To(Equal(http.StatusConflict), descUnexpectedHTTPStatus, rr1.Body.String())
		})

		It("should fail when the YAML has the wrong kind", func() {
			wrongKindYAML := []byte(`
apiVersion: v1
kind: Pod
metadata:
  name: i-am-the-wrong-kind`)

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(wrongKindYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())
			Expect(rr.Body.String()).To(ContainSubstring("unable to decode /v1, Kind=Pod into *v1beta1.WorkspaceKind"))
		})

		It("should fail when the body is not valid YAML", func() {
			notYAML := []byte(`this is not yaml {`)

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(notYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())

			By("decoding the error response")
			var response ErrorEnvelope
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the error message indicates a decoding failure")
			Expect(response.Error.Message).To(ContainSubstring("error decoding request body: couldn't get version/kind; json parse error"))
		})

		It("should fail for an empty YAML object", func() {
			invalidYAML := []byte("{}")

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, AllWorkspaceKindsPath, bytes.NewReader(invalidYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing the CreateWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("decoding the error response")
			var response ErrorEnvelope
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the error message indicates a validation failure")
			Expect(response.Error.Cause.ValidationErrors).To(BeComparableTo(
				[]ValidationError{
					{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeRequired,
						Field:   "apiVersion",
						Message: field.ErrorTypeRequired.String(),
					},
					{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeRequired,
						Field:   "kind",
						Message: field.ErrorTypeRequired.String(),
					},
					{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeRequired,
						Field:   "metadata.name",
						Message: field.ErrorTypeRequired.String(),
					},
				},
			))
		})
	})
})
