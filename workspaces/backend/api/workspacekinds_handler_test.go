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
	"k8s.io/utils/ptr"

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

			By("ensuring the response matches the expected WorkspaceKindUpdate")
			expectedWorkspaceKindUpdate := models.NewWorkspaceKindUpdateModelFromWorkspaceKind(workspacekind1)
			Expect(response.Data).To(BeComparableTo(expectedWorkspaceKindUpdate))

			By("ensuring the revision is non-empty")
			Expect(response.Data.Revision).NotTo(BeEmpty())

			By("ensuring the wrapped data can be marshaled to JSON and back")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject models.WorkspaceKindUpdate
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to WorkspaceKindUpdate")
		})

		It("should retrieve WorkspaceKinds with valid namespaceFilter query parameter", func() {
			By("creating the HTTP request with namespaceFilter query parameter")
			req, err := http.NewRequest(http.MethodGet, AllWorkspaceKindsPath+"?namespaceFilter="+namespaceName1, http.NoBody)
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
		})

		It("should return 422 for an invalid namespaceFilter query parameter", func() {
			By("creating the HTTP request with an invalid namespaceFilter query parameter")
			req, err := http.NewRequest(http.MethodGet, AllWorkspaceKindsPath+"?namespaceFilter=INVALID_NS!!!", http.NoBody)
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
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("decoding the error response")
			var response ErrorEnvelope
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the error message indicates a query parameter validation failure")
			Expect(response.Error.Message).To(Equal(errMsgQueryParamsInvalid))
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(NamespaceFilterQueryParam))
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

	Context("when updating a WorkspaceKind", Serial, Ordered, func() {

		var (
			wskName     string
			wskRevision string
		)

		// getWorkspaceKindData is a helper that GETs the workspace kind and returns the response data.
		getWorkspaceKindData := func(name string) *models.WorkspaceKindUpdate {
			getReq, err := http.NewRequest(http.MethodGet, strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, name, 1), http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			getReq.Header.Set(userIdHeader, adminUser)
			getRR := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(getRR, getReq, httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: name},
			})
			Expect(getRR.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, getRR.Body.String())
			var getResponse WorkspaceKindEnvelope
			err = json.Unmarshal(getRR.Body.Bytes(), &getResponse)
			Expect(err).NotTo(HaveOccurred())
			return getResponse.Data
		}

		// doUpdate is a helper that PUTs the update body and returns the recorder.
		doUpdate := func(name, body string) *httptest.ResponseRecorder {
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, name, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(body))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeJson)
			req.Header.Set(userIdHeader, adminUser)
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: name},
			}
			rr := httptest.NewRecorder()
			a.UpdateWorkspaceKindHandler(rr, req, ps)
			return rr
		}

		BeforeAll(func() {
			wskName = "wsk-update-test"

			By("creating the WorkspaceKind")
			wsk := NewExampleWorkspaceKind(wskName)
			Expect(k8sClient.Create(ctx, wsk)).To(Succeed())

			By("getting the revision via GET")
			data := getWorkspaceKindData(wskName)
			wskRevision = data.Revision
			Expect(wskRevision).NotTo(BeEmpty())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			wsk := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: wskName,
				},
			}
			Expect(k8sClient.Delete(ctx, wsk)).To(Succeed())
		})

		It("should update a WorkspaceKind successfully", func() {
			By("getting current data from GET response")
			getData := getWorkspaceKindData(wskName)

			By("building the update request body using the GET response data")
			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing UpdateWorkspaceKindHandler")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("unmarshalling the response JSON")
			var response WorkspaceKindEnvelope
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the response has a revision")
			Expect(response.Data).NotTo(BeNil())
			Expect(response.Data.Revision).NotTo(BeEmpty())

			By("updating the stored revision for subsequent tests")
			wskRevision = response.Data.Revision
		})

		It("should update spawner.deprecated and persist the change", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.Spawner.Deprecated).NotTo(BeNil())

			By("toggling deprecated to true")
			getData.Spawner.Deprecated = ptr.To(true)
			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the change persists via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.Spawner.Deprecated).NotTo(BeNil())
			Expect(*updatedData.Spawner.Deprecated).To(BeTrue())

			By("verifying immutable fields are unchanged in K8s")
			wsk := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: wskName}, wsk)).To(Succeed())
			Expect(wsk.Spec.PodTemplate.ServiceAccount.Name).To(Equal("default-editor"))
			Expect(wsk.Spec.PodTemplate.VolumeMounts.Home).To(Equal("/home/jovyan"))
		})

		It("should toggle option hidden and persist the change", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("setting hidden on the first imageConfig option")
			Expect(getData.PodTemplate.Options.ImageConfig.Values).NotTo(BeEmpty())
			getData.PodTemplate.Options.ImageConfig.Values[0].Hidden = ptr.To(false)

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the change persists via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.PodTemplate.Options.ImageConfig.Values[0].Hidden).NotTo(BeNil())
			Expect(*updatedData.PodTemplate.Options.ImageConfig.Values[0].Hidden).To(BeFalse())
		})

		It("should add a new imageConfig option successfully", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			originalCount := len(getData.PodTemplate.Options.ImageConfig.Values)

			By("adding a new imageConfig option with spawner and spec")
			newSpawner := kubefloworgv1beta1.OptionSpawnerInfo{
				DisplayName: "new-image:v1.0.0",
				Description: ptr.To("A new image option"),
			}
			newSpec := kubefloworgv1beta1.ImageConfigSpec{
				Image: "ghcr.io/kubeflow/new-image:v1.0.0",
				Ports: []kubefloworgv1beta1.ImagePort{
					{
						Id:   "jupyterlab",
						Port: 8888,
					},
				},
			}
			getData.PodTemplate.Options.ImageConfig.Values = append(getData.PodTemplate.Options.ImageConfig.Values,
				models.ImageConfigValueMutate{
					Id:      "new_image_option",
					Spawner: &newSpawner,
					Spec:    &newSpec,
				},
			)

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the new option appears via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.PodTemplate.Options.ImageConfig.Values).To(HaveLen(originalCount + 1))

			By("verifying the new option has the correct values")
			lastOption := updatedData.PodTemplate.Options.ImageConfig.Values[len(updatedData.PodTemplate.Options.ImageConfig.Values)-1]
			Expect(lastOption.Id).To(Equal("new_image_option"))
			Expect(lastOption.Spawner).NotTo(BeNil())
			Expect(lastOption.Spawner.DisplayName).To(Equal("new-image:v1.0.0"))
			Expect(lastOption.Spec).NotTo(BeNil())
			Expect(lastOption.Spec.Image).To(Equal("ghcr.io/kubeflow/new-image:v1.0.0"))
		})

		It("should return 422 when changing existing imageConfig spec", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("modifying the spec.image of an existing option")
			Expect(getData.PodTemplate.Options.ImageConfig.Values).NotTo(BeEmpty())
			modifiedSpec := *getData.PodTemplate.Options.ImageConfig.Values[0].Spec
			modifiedSpec.Image = "modified-image:latest"
			getData.PodTemplate.Options.ImageConfig.Values[0].Spec = &modifiedSpec

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying 422 response")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the error mentions immutable spec")
			Expect(rr.Body.String()).To(ContainSubstring("spec is immutable"))
		})

		It("should return 422 when changing existing imageConfig spawner", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("modifying the spawner of an existing option")
			Expect(getData.PodTemplate.Options.ImageConfig.Values).NotTo(BeEmpty())
			modifiedSpawner := *getData.PodTemplate.Options.ImageConfig.Values[0].Spawner
			modifiedSpawner.DisplayName = "Modified Display Name"
			getData.PodTemplate.Options.ImageConfig.Values[0].Spawner = &modifiedSpawner

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying 422 response")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the error mentions immutable spawner")
			Expect(rr.Body.String()).To(ContainSubstring("spawner is immutable"))
		})

		It("should return 422 when changing existing podConfig spec", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("modifying the spec of an existing podConfig option")
			Expect(getData.PodTemplate.Options.PodConfig.Values).NotTo(BeEmpty())
			modifiedSpec := *getData.PodTemplate.Options.PodConfig.Values[0].Spec
			modifiedSpec.NodeSelector = map[string]string{"modified": "true"}
			getData.PodTemplate.Options.PodConfig.Values[0].Spec = &modifiedSpec

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying 422 response")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the error mentions immutable spec")
			Expect(rr.Body.String()).To(ContainSubstring("spec is immutable"))
		})

		It("should return 422 when new imageConfig option is missing spawner", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("adding a new option without spawner")
			getData.PodTemplate.Options.ImageConfig.Values = append(getData.PodTemplate.Options.ImageConfig.Values,
				models.ImageConfigValueMutate{
					Id:      "new-option-no-spawner",
					Spawner: nil,
					Spec:    getData.PodTemplate.Options.ImageConfig.Values[0].Spec,
				},
			)

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying 422 response")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the error mentions required spawner")
			Expect(rr.Body.String()).To(ContainSubstring("spawner is required"))
		})

		It("should return 422 when new imageConfig option is missing spec", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("adding a new option without spec")
			getData.PodTemplate.Options.ImageConfig.Values = append(getData.PodTemplate.Options.ImageConfig.Values,
				models.ImageConfigValueMutate{
					Id:      "new-option-no-spec",
					Spawner: getData.PodTemplate.Options.ImageConfig.Values[0].Spawner,
					Spec:    nil,
				},
			)

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying 422 response")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the error mentions required spec")
			Expect(rr.Body.String()).To(ContainSubstring("spec is required"))
		})

		It("should return 404 for a non-existent WorkspaceKind", func() {
			missingName := "non-existent-wsk"
			updateBody := `{
				"data": {
					"revision": "fake-revision",
					"spawner": {"displayName": "Test", "description": "Test", "icon": {}, "logo": {}},
					"podTemplate": {"options": {"imageConfig": {"spawner": {"default": ""}, "values": []}, "podConfig": {"spawner": {"default": ""}, "values": []}}}
				}
			}`

			By("executing UpdateWorkspaceKindHandler")
			rr := doUpdate(missingName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 409 for a stale revision", func() {
			updateBody := `{
				"data": {
					"revision": "stale-revision-that-does-not-match",
					"spawner": {"displayName": "Test", "description": "Test", "icon": {}, "logo": {}},
					"podTemplate": {"options": {"imageConfig": {"spawner": {"default": ""}, "values": []}, "podConfig": {"spawner": {"default": ""}, "values": []}}}
				}
			}`

			By("executing UpdateWorkspaceKindHandler")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusConflict), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 415 for wrong Content-Type", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, wskName, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(`{}`))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: wskName},
			}
			rr := httptest.NewRecorder()
			a.UpdateWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnsupportedMediaType), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 for missing revision", func() {
			updateBody := `{
				"data": {
					"revision": "",
					"spawner": {"displayName": "Test", "description": "Test", "icon": {}, "logo": {}},
					"podTemplate": {"options": {"imageConfig": {"spawner": {"default": ""}, "values": []}, "podConfig": {"spawner": {"default": ""}, "values": []}}}
				}
			}`

			By("executing UpdateWorkspaceKindHandler")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 for missing revision even with valid spawner data", func() {
			By("getting current data to build a valid body without revision")
			getData := getWorkspaceKindData(wskName)
			getData.Revision = ""

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing UpdateWorkspaceKindHandler")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the error mentions revision")
			Expect(rr.Body.String()).To(ContainSubstring("revision"))
		})

		It("should return 400 for invalid JSON body", func() {
			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, wskName, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(`{invalid json`))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeJson)
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: wskName},
			}
			rr := httptest.NewRecorder()
			a.UpdateWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 for invalid path param", func() {
			invalidName := "INVALID_NAME!!!"

			By("creating the HTTP request")
			path := strings.Replace(WorkspaceKindsByNamePath, ":"+ResourceNamePathParam, invalidName, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(`{}`))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", MediaTypeJson)
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: ResourceNamePathParam, Value: invalidName},
			}
			rr := httptest.NewRecorder()
			a.UpdateWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 when data is null", func() {
			updateBody := `{"data": null}`

			By("executing UpdateWorkspaceKindHandler")
			rr := doUpdate(wskName, updateBody)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})
})
