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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	commonModels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
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
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath, http.NoBody)
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
			// admin listing (no namespaceFilter): matchNamespace filterRules do not fire
			expectedModel1, apiHide1 := models.NewWorkspaceKindModelFromWorkspaceKind(a.Config, workspacekind1, nil)
			expectedModel2, apiHide2 := models.NewWorkspaceKindModelFromWorkspaceKind(a.Config, workspacekind2, nil)
			Expect(apiHide1).To(BeFalse())
			Expect(apiHide2).To(BeFalse())
			Expect(response.Data).To(ConsistOf(expectedModel1, expectedModel2))

			By("ensuring the statefulSetMetadata from the WorkspaceKind is surfaced in the response")
			var item1 models.WorkspaceKindListItem
			for _, wsk := range response.Data {
				if wsk.Name == workspaceKind1Name {
					item1 = wsk
				}
			}
			Expect(item1.Name).To(Equal(workspaceKind1Name), "WorkspaceKind %q not found in response", workspaceKind1Name)
			Expect(item1.PodTemplate.StatefulSetMetadata.Labels).To(HaveKeyWithValue("my-sts-label", "my-value"))
			Expect(item1.PodTemplate.StatefulSetMetadata.Annotations).To(HaveKeyWithValue("my-sts-annotation", "my-value"))

			By("ensuring the wrapped data can be marshaled to JSON and back to []WorkspaceKind")
			dataJSON, err := json.Marshal(response.Data)
			Expect(err).NotTo(HaveOccurred(), "failed to marshal data to JSON")
			var dataObject []models.WorkspaceKindListItem
			err = json.Unmarshal(dataJSON, &dataObject)
			Expect(err).NotTo(HaveOccurred(), "failed to unmarshal JSON to []WorkspaceKind")
		})

		It("should retrieve a single WorkspaceKind successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, workspaceKind1Name, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: workspaceKind1Name},
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
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath+"?namespaceFilter="+namespaceName1, http.NoBody)
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

			By("getting the filtered Namespace from the Kubernetes API")
			namespace1 := &corev1.Namespace{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: namespaceName1}, namespace1)).To(Succeed())

			By("ensuring the response contains the expected WorkspaceKinds")
			// the example WorkspaceKinds define no WORKSPACE_KIND filterRules, so the
			// namespaceFilter's labels have no effect and nothing is hidden or denied
			expectedModel1, apiHide1 := models.NewWorkspaceKindModelFromWorkspaceKind(a.Config, workspacekind1, namespace1.Labels)
			expectedModel2, apiHide2 := models.NewWorkspaceKindModelFromWorkspaceKind(a.Config, workspacekind2, namespace1.Labels)
			Expect(apiHide1).To(BeFalse())
			Expect(apiHide2).To(BeFalse())
			Expect(response.Data).To(ConsistOf(expectedModel1, expectedModel2))
		})

		It("should return 422 for an invalid namespaceFilter query parameter", func() {
			By("creating the HTTP request with an invalid namespaceFilter query parameter")
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath+"?namespaceFilter=INVALID_NS!!!", http.NoBody)
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
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(constants.NamespaceFilterQueryParam))
		})

		It("should return 422 when the namespaceFilter references a non-existent namespace", func() {
			By("creating the HTTP request with a namespaceFilter for a non-existent namespace")
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath+"?namespaceFilter=non-existent-ns", http.NoBody)
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

			By("verifying the error indicates a validation failure")
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
		})
	})

	// NOTE: these tests create WorkspaceKinds with WORKSPACE_KIND-scoped filterRules and a labeled
	//       namespace, so they assume a specific cluster state and must run serially and in order.
	Context("with WorkspaceKinds that define filterRules", Serial, Ordered, func() {

		const prodNamespaceName = "wsk-filterrules-prod-ns"

		var (
			hiddenWSKName  string // WORKSPACE_KIND rule with ui.hide
			deniedWSKName  string // WORKSPACE_KIND rule with api.deny
			omittedWSKName string // WORKSPACE_KIND rule with api.hide
			plainWSKName   string // no filterRules
		)

		// wskWithWorkspaceKindRule returns a WorkspaceKind with a single WORKSPACE_KIND-scoped rule
		// that fires when the namespace has the label tier=prod.
		wskWithWorkspaceKindRule := func(name string, effect kubefloworgv1beta1.FilterRuleEffect) *kubefloworgv1beta1.WorkspaceKind {
			wsk := NewExampleWorkspaceKind(name)
			wsk.Spec.FilterRules = []kubefloworgv1beta1.FilterRule{
				{
					Scope:  kubefloworgv1beta1.FilterRuleScopeWorkspaceKind,
					Effect: effect,
					Match: []kubefloworgv1beta1.FilterRuleMatch{
						{
							MatchNamespace: &kubefloworgv1beta1.FilterRuleSelector{
								Selector: metav1.LabelSelector{MatchLabels: map[string]string{"tier": "prod"}},
							},
						},
					},
				},
			}
			return wsk
		}

		BeforeAll(func() {
			hiddenWSKName = "wsk-filterrules-hidden"
			deniedWSKName = "wsk-filterrules-denied"
			omittedWSKName = "wsk-filterrules-omitted"
			plainWSKName = "wsk-filterrules-plain"

			By("creating the prod Namespace with tier=prod label")
			prodNamespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name:   prodNamespaceName,
					Labels: map[string]string{"tier": "prod"},
				},
			}
			Expect(k8sClient.Create(ctx, prodNamespace)).To(Succeed())

			By("creating a WorkspaceKind with a ui.hide rule")
			Expect(k8sClient.Create(ctx, wskWithWorkspaceKindRule(hiddenWSKName,
				kubefloworgv1beta1.FilterRuleEffect{UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: true}}))).To(Succeed())

			By("creating a WorkspaceKind with an api.deny rule")
			Expect(k8sClient.Create(ctx, wskWithWorkspaceKindRule(deniedWSKName,
				kubefloworgv1beta1.FilterRuleEffect{
					API: &kubefloworgv1beta1.FilterRuleEffectAPI{
						Deny:        new(true),
						DenyMessage: &kubefloworgv1beta1.FilterRuleDenyMessage{Text: "not allowed in prod"},
					},
				}))).To(Succeed())

			By("creating a WorkspaceKind with an api.hide rule")
			Expect(k8sClient.Create(ctx, wskWithWorkspaceKindRule(omittedWSKName,
				kubefloworgv1beta1.FilterRuleEffect{API: &kubefloworgv1beta1.FilterRuleEffectAPI{Hide: new(true)}}))).To(Succeed())

			By("creating a WorkspaceKind with no filterRules")
			Expect(k8sClient.Create(ctx, NewExampleWorkspaceKind(plainWSKName))).To(Succeed())
		})

		AfterAll(func() {
			for _, name := range []string{hiddenWSKName, deniedWSKName, omittedWSKName, plainWSKName} {
				Expect(k8sClient.Delete(ctx, &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{Name: name},
				})).To(Succeed())
			}
			Expect(k8sClient.Delete(ctx, &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: prodNamespaceName},
			})).To(Succeed())
		})

		// listWithNamespaceFilter lists WorkspaceKinds filtered by the given namespace and returns
		// the decoded response items keyed by name.
		listWithNamespaceFilter := func(namespace string) map[string]models.WorkspaceKindListItem {
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath+"?namespaceFilter="+namespace, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			rr := httptest.NewRecorder()
			a.GetWorkspaceKindsHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			var response WorkspaceKindListEnvelope
			Expect(json.NewDecoder(rs.Body).Decode(&response)).To(Succeed())

			byName := make(map[string]models.WorkspaceKindListItem, len(response.Data))
			for _, item := range response.Data {
				byName[item.Name] = item
			}
			return byName
		}

		It("evaluates the WORKSPACE_KIND filterRules against the namespaceFilter labels", func() {
			By("listing WorkspaceKinds filtered by the prod namespace")
			byName := listWithNamespaceFilter(prodNamespaceName)

			By("hiding the WorkspaceKind whose ui.hide rule matches")
			Expect(byName).To(HaveKey(hiddenWSKName))
			Expect(byName[hiddenWSKName].Hidden).To(BeTrue())

			By("denying the WorkspaceKind whose api.deny rule matches")
			Expect(byName).To(HaveKey(deniedWSKName))
			Expect(byName[deniedWSKName].Restrictions).To(BeComparableTo(commonModels.Restrictions{
				Deny:        true,
				DenyMessage: &commonModels.DenyMessage{Text: "not allowed in prod"},
			}))

			By("omitting the WorkspaceKind whose api.hide rule matches")
			Expect(byName).NotTo(HaveKey(omittedWSKName))

			By("leaving the WorkspaceKind without filterRules unaffected")
			Expect(byName).To(HaveKey(plainWSKName))
			Expect(byName[plainWSKName].Hidden).To(BeFalse())
			Expect(byName[plainWSKName].Restrictions).To(BeComparableTo(commonModels.DefaultRestrictions()))
		})

		It("does not fire the rules when the namespace labels do not match", func() {
			By("creating a namespace without the tier=prod label")
			devNamespaceName := "wsk-filterrules-dev-ns"
			Expect(k8sClient.Create(ctx, &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: devNamespaceName},
			})).To(Succeed())
			defer func() {
				Expect(k8sClient.Delete(ctx, &corev1.Namespace{
					ObjectMeta: metav1.ObjectMeta{Name: devNamespaceName},
				})).To(Succeed())
			}()

			By("listing WorkspaceKinds filtered by the dev namespace")
			byName := listWithNamespaceFilter(devNamespaceName)

			By("returning every WorkspaceKind unaffected (nothing hidden, denied, or omitted)")
			for _, name := range []string{hiddenWSKName, deniedWSKName, omittedWSKName, plainWSKName} {
				Expect(byName).To(HaveKey(name))
				Expect(byName[name].Hidden).To(BeFalse())
				Expect(byName[name].Restrictions).To(BeComparableTo(commonModels.DefaultRestrictions()))
			}
		})
	})

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing WorkspaceKinds", Serial, func() {

		It("should return an empty list of WorkspaceKinds", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath, http.NoBody)
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
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, missingWorkspaceKindName, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: missingWorkspaceKindName},
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
			//nolint:modernize
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
			req, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeYaml)
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

			By("verifying the audit annotations were set")
			Expect(createdWsk.Annotations).To(BeEquivalentTo(
				map[string]string{
					commonModels.AnnotationCreatedBy: adminUser,
					commonModels.AnnotationUpdatedBy: adminUser,
				},
			))
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
			req, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(missingNameYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeYaml)
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
			req1, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req1.Header.Set("Content-Type", constants.MediaTypeYaml)
			req1.Header.Set(userIdHeader, adminUser)

			By("executing CreateWorkspaceKindHandler for the first time")
			rr1 := httptest.NewRecorder()
			a.CreateWorkspaceKindHandler(rr1, req1, httprouter.Params{})
			rs1 := rr1.Result()
			defer rs1.Body.Close()

			By("verifying the HTTP response status code for the first request")
			Expect(rs1.StatusCode).To(Equal(http.StatusCreated), descUnexpectedHTTPStatus, rr1.Body.String())

			By("creating a second HTTP request")
			req2, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(validYAML))
			Expect(err).NotTo(HaveOccurred())
			req2.Header.Set("Content-Type", constants.MediaTypeYaml)
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
			req, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(wrongKindYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeYaml)
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
			req, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(notYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeYaml)
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
			req, err := http.NewRequest(http.MethodPost, constants.AllWorkspaceKindsPath, bytes.NewReader(invalidYAML))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeYaml)
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

	Context("with ConfigMap-based assets in status", Serial, Ordered, func() {

		var (
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeAll(func() {
			workspaceKindName = "wsk-configmap-asset-test"
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating a WorkspaceKind with ConfigMap-based assets")
			wk := NewExampleWorkspaceKind(workspaceKindName)
			// Override URL-based assets with ConfigMap-based assets
			wk.Spec.Spawner.Icon = kubefloworgv1beta1.WorkspaceKindAsset{
				ConfigMap: &kubefloworgv1beta1.WorkspaceKindAssetConfigMap{
					Name:      "my-icons",
					Key:       "icon.svg",
					Namespace: "default",
					MediaType: kubefloworgv1beta1.WorkspaceKindAssetMediaTypeSVG,
				},
			}
			wk.Spec.Spawner.Logo = kubefloworgv1beta1.WorkspaceKindAsset{
				ConfigMap: &kubefloworgv1beta1.WorkspaceKindAssetConfigMap{
					Name:      "my-logos",
					Key:       "logo.svg",
					Namespace: "default",
					MediaType: kubefloworgv1beta1.WorkspaceKindAssetMediaTypeSVG,
				},
			}
			Expect(k8sClient.Create(ctx, wk)).To(Succeed())

			By("populating the WorkspaceKind status with SHA256 hashes")
			// Re-fetch to get the latest resourceVersion after create
			Expect(k8sClient.Get(ctx, workspaceKindKey, wk)).To(Succeed())
			wk.Status.SpawnerIcon = kubefloworgv1beta1.ImageAssetStatus{
				Sha256: "abc123iconhash",
			}
			wk.Status.SpawnerLogo = kubefloworgv1beta1.ImageAssetStatus{
				Sha256: "def456logohash",
			}
			// The CRD requires podTemplateOptions in status
			wk.Status.PodTemplateOptions = kubefloworgv1beta1.PodTemplateOptionsMetrics{
				ImageConfig: []kubefloworgv1beta1.OptionMetric{},
				PodConfig:   []kubefloworgv1beta1.OptionMetric{},
			}
			Expect(k8sClient.Status().Update(ctx, wk)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			wk := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			Expect(k8sClient.Delete(ctx, wk)).To(Succeed())
		})

		It("should include SHA256 query parameters in icon and logo URLs (list)", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, constants.AllWorkspaceKindsPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceKindsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspaceKindsHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the response")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())
			var response WorkspaceKindListEnvelope
			Expect(json.Unmarshal(body, &response)).To(Succeed())

			By("finding the WorkspaceKind with ConfigMap assets in the response")
			var found *models.WorkspaceKindListItem
			for i := range response.Data {
				if response.Data[i].Name == workspaceKindName {
					found = &response.Data[i]
					break
				}
			}
			Expect(found).NotTo(BeNil(), "WorkspaceKind %q not found in response", workspaceKindName)

			By("verifying the icon URL contains the SHA256 query parameter")
			Expect(found.Icon.URL).To(ContainSubstring("sha256=abc123iconhash"))
			Expect(found.Icon.Error).To(BeNil())

			By("verifying the logo URL contains the SHA256 query parameter")
			Expect(found.Logo.URL).To(ContainSubstring("sha256=def456logohash"))
			Expect(found.Logo.Error).To(BeNil())
		})
	})

	// NOTE: these tests create and delete resources on the cluster, so cannot be run in parallel.
	//       therefore, we run them using the `Serial` Ginkgo decorator.
	Context("when deleting a WorkspaceKind", Serial, func() {

		var (
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
		)

		BeforeEach(func() {
			uniqueName := fmt.Sprintf("wsk-delete-test-%d", GinkgoRandomSeed())
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind to delete")
			workspaceKindToDelete := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKindToDelete)).To(Succeed())
		})

		AfterEach(func() {
			By("cleaning up the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			_ = k8sClient.Delete(ctx, workspaceKind)
		})

		It("should successfully delete an existing WorkspaceKind", func() {
			By("creating the HTTP request to delete the WorkspaceKind")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, workspaceKindName, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			ps := httprouter.Params{
				httprouter.Param{
					Key:   constants.ResourceNamePathParam,
					Value: workspaceKindName,
				},
			}
			a.DeleteWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNoContent), descUnexpectedHTTPStatus, rr.Body.String())

			By("ensuring the WorkspaceKind has been deleted")
			deletedWorkspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			err = k8sClient.Get(ctx, workspaceKindKey, deletedWorkspaceKind)
			Expect(err).To(HaveOccurred())
			Expect(apierrors.IsNotFound(err)).To(BeTrue())
		})

		It("should return 404 when trying to delete a non-existent WorkspaceKind", func() {
			nonExistentName := "non-existent-workspacekind"

			By("creating the HTTP request to delete a non-existent WorkspaceKind")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, nonExistentName, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			ps := httprouter.Params{
				httprouter.Param{
					Key:   constants.ResourceNamePathParam,
					Value: nonExistentName,
				},
			}
			a.DeleteWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 when workspace kind name has invalid format", func() {
			invalidName := "InvalidNameWithUppercase"

			By("creating the HTTP request with invalid workspace kind name")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, invalidName, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			ps := httprouter.Params{
				httprouter.Param{
					Key:   constants.ResourceNamePathParam,
					Value: invalidName,
				},
			}
			a.DeleteWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())

			By("decoding the error response")
			var response ErrorEnvelope
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying the error message indicates validation failure")
			Expect(response.Error.Message).To(ContainSubstring("path parameters were invalid"))
		})

		It("should return 401 when no authentication is provided", func() {
			By("creating the HTTP request without auth headers")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, workspaceKindName, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("executing DeleteWorkspaceKindHandler without auth")
			rr := httptest.NewRecorder()
			ps := httprouter.Params{
				httprouter.Param{
					Key:   constants.ResourceNamePathParam,
					Value: workspaceKindName,
				},
			}
			a.DeleteWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnauthorized), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 403 when user lacks permission to delete workspace kind", func() {
			By("creating the HTTP request with non-admin user")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, workspaceKindName, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers with non-admin user")
			req.Header.Set(userIdHeader, "non-admin-user")

			By("executing DeleteWorkspaceKindHandler")
			rr := httptest.NewRecorder()
			ps := httprouter.Params{
				httprouter.Param{
					Key:   constants.ResourceNamePathParam,
					Value: workspaceKindName,
				},
			}
			a.DeleteWorkspaceKindHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusForbidden), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	Context("when updating a WorkspaceKind", Serial, Ordered, func() {

		var wskName string

		newFilterRule := func(hide bool) kubefloworgv1beta1.FilterRule {
			return kubefloworgv1beta1.FilterRule{
				Scope: kubefloworgv1beta1.FilterRuleScopeImageConfig,
				Effect: kubefloworgv1beta1.FilterRuleEffect{
					UI: &kubefloworgv1beta1.FilterRuleEffectUI{Hide: hide},
				},
				Match: []kubefloworgv1beta1.FilterRuleMatch{
					{
						MatchImageConfig: &kubefloworgv1beta1.FilterRuleSelector{
							Selector: metav1.LabelSelector{
								MatchLabels: map[string]string{"gpu": "true"},
							},
						},
					},
				},
			}
		}

		getWorkspaceKindData := func(name string) *models.WorkspaceKindUpdate {
			getReq, err := http.NewRequest(http.MethodGet, strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, name, 1), http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			getReq.Header.Set(userIdHeader, adminUser)
			getRR := httptest.NewRecorder()
			a.GetWorkspaceKindHandler(getRR, getReq, httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: name},
			})
			Expect(getRR.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, getRR.Body.String())
			var getResponse WorkspaceKindEnvelope
			err = json.Unmarshal(getRR.Body.Bytes(), &getResponse)
			Expect(err).NotTo(HaveOccurred())
			return getResponse.Data
		}

		doUpdate := func(name, body string) *httptest.ResponseRecorder {
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, name, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(body))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeJson)
			req.Header.Set(userIdHeader, adminUser)
			ps := httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: name},
			}
			rr := httptest.NewRecorder()
			a.UpdateWorkspaceKindHandler(rr, req, ps)
			return rr
		}

		BeforeAll(func() {
			wskName = "wsk-update-test"

			By("creating the WorkspaceKind")
			wsk := NewExampleWorkspaceKind(wskName)
			wsk.Spec.FilterRules = []kubefloworgv1beta1.FilterRule{
				newFilterRule(true),
			}
			Expect(k8sClient.Create(ctx, wsk)).To(Succeed())

			By("getting the revision via GET")
			data := getWorkspaceKindData(wskName)
			Expect(data.Revision).NotTo(BeEmpty())
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

			By("getting the updated WorkspaceKind from the Kubernetes API")
			updatedWsk := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: wskName}, updatedWsk)).To(Succeed())

			By("verifying the audit annotations were updated")
			Expect(updatedWsk.Annotations[commonModels.AnnotationUpdatedBy]).To(Equal(adminUser))
			Expect(updatedWsk.Annotations).To(HaveKey(commonModels.AnnotationUpdatedAt))
		})

		It("should update spawner.deprecated and persist the change", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.Spawner.Deprecated).NotTo(BeNil())

			By("toggling deprecated to true")
			getData.Spawner.Deprecated = new(true)
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
			Expect(wsk.Spec.PodTemplate.VolumeMounts.Home).To(Equal("/home/jovyan"))
		})

		It("should toggle option hidden and persist the change", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)

			By("setting hidden on the first imageConfig option")
			Expect(getData.PodTemplate.Options.ImageConfig.Values).NotTo(BeEmpty())
			getData.PodTemplate.Options.ImageConfig.Values[0].Spawner.Hidden = new(false)

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the change persists via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.PodTemplate.Options.ImageConfig.Values[0].Spawner.Hidden).NotTo(BeNil())
			Expect(*updatedData.PodTemplate.Options.ImageConfig.Values[0].Spawner.Hidden).To(BeFalse())
		})

		It("should add a new imageConfig option successfully", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			originalCount := len(getData.PodTemplate.Options.ImageConfig.Values)

			By("adding a new imageConfig option with spawner and spec")
			getData.PodTemplate.Options.ImageConfig.Values = append(getData.PodTemplate.Options.ImageConfig.Values,
				kubefloworgv1beta1.ImageConfigValue{
					Id: "new_image_option",
					Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
						DisplayName: "new-image:v1.0.0",
						Description: new("A new image option"),
					},
					Spec: kubefloworgv1beta1.ImageConfigSpec{
						Image: "ghcr.io/kubeflow/new-image:v1.0.0",
						Ports: []kubefloworgv1beta1.ImagePort{
							{
								Id:   "jupyterlab",
								Port: 8888,
							},
						},
					},
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
			Expect(lastOption.Spawner.DisplayName).To(Equal("new-image:v1.0.0"))
			Expect(lastOption.Spec.Image).To(Equal("ghcr.io/kubeflow/new-image:v1.0.0"))
		})

		It("should add a new podConfig option successfully", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			originalCount := len(getData.PodTemplate.Options.PodConfig.Values)

			By("adding a new podConfig option with spawner and spec")
			getData.PodTemplate.Options.PodConfig.Values = append(getData.PodTemplate.Options.PodConfig.Values,
				kubefloworgv1beta1.PodConfigValue{
					Id: "new_pod_option",
					Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
						DisplayName: "New Pod Config",
						Description: new("A new pod config option"),
					},
					Spec: kubefloworgv1beta1.PodConfigSpec{
						Resources: &corev1.ResourceRequirements{
							Requests: map[corev1.ResourceName]resource.Quantity{
								corev1.ResourceCPU:    resource.MustParse("500m"),
								corev1.ResourceMemory: resource.MustParse("256Mi"),
							},
						},
					},
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
			Expect(updatedData.PodTemplate.Options.PodConfig.Values).To(HaveLen(originalCount + 1))

			By("verifying the new option has the correct values")
			lastOption := updatedData.PodTemplate.Options.PodConfig.Values[len(updatedData.PodTemplate.Options.PodConfig.Values)-1]
			Expect(lastOption.Id).To(Equal("new_pod_option"))
			Expect(lastOption.Spawner.DisplayName).To(Equal("New Pod Config"))
			Expect(lastOption.Spec.Resources).NotTo(BeNil())
		})

		It("should add activityRules and persist the change", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.ActivityRules).To(BeEmpty())

			By("adding activity rules")
			getData.ActivityRules = []kubefloworgv1beta1.ActivityRule{
				{
					Config: kubefloworgv1beta1.ActivityRuleConfig{
						SecondsSinceActive: 3600,
					},
					Effect: kubefloworgv1beta1.ActivityRuleEffect{
						PauseWorkspace: new(true),
					},
				},
			}

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the change persists via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.ActivityRules).To(HaveLen(1))
			Expect(updatedData.ActivityRules[0].Config.SecondsSinceActive).To(Equal(int32(3600)))
			Expect(updatedData.ActivityRules[0].Effect.PauseWorkspace).NotTo(BeNil())
			Expect(*updatedData.ActivityRules[0].Effect.PauseWorkspace).To(BeTrue())

			By("verifying the CRD was updated in Kubernetes")
			wsk := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: wskName}, wsk)).To(Succeed())
			Expect(wsk.Spec.ActivityRules).To(HaveLen(1))
			Expect(wsk.Spec.ActivityRules[0].Config.SecondsSinceActive).To(Equal(int32(3600)))
		})

		It("should edit existing activityRules and persist the change", func() {
			By("getting current data (has 1 rule from previous test)")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.ActivityRules).To(HaveLen(1))

			By("modifying the existing rule's timeout")
			getData.ActivityRules[0].Config.SecondsSinceActive = 7200

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the change persists via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.ActivityRules).To(HaveLen(1))
			Expect(updatedData.ActivityRules[0].Config.SecondsSinceActive).To(Equal(int32(7200)))
		})

		It("should clear activityRules when omitted from update", func() {
			By("getting current data (has 1 rule from previous test)")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.ActivityRules).To(HaveLen(1))

			By("setting activityRules to nil to simulate omission")
			getData.ActivityRules = nil

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying activityRules are cleared via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.ActivityRules).To(BeEmpty())

			By("verifying the CRD was updated in Kubernetes")
			wsk := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: wskName}, wsk)).To(Succeed())
			Expect(wsk.Spec.ActivityRules).To(BeEmpty())
		})

		It("should include filterRules in the WorkspaceKind GET response", func() {
			By("getting the WorkspaceKind through the API")
			getData := getWorkspaceKindData(wskName)

			By("verifying filterRules are included in the response")
			Expect(getData.FilterRules).To(BeComparableTo(
				[]kubefloworgv1beta1.FilterRule{newFilterRule(true)},
			))
		})

		It("should edit existing filterRules and persist the change", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.FilterRules).To(BeComparableTo(
				[]kubefloworgv1beta1.FilterRule{newFilterRule(true)},
			))

			By("modifying the existing filter rule")
			getData.FilterRules[0].Effect.UI.Hide = false

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(
				Equal(http.StatusOK),
				descUnexpectedHTTPStatus,
				rr.Body.String(),
			)

			By("verifying the change persists via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.FilterRules).To(BeComparableTo(
				[]kubefloworgv1beta1.FilterRule{newFilterRule(false)},
			))

			By("verifying the CRD was updated in Kubernetes")
			wsk := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(
				ctx,
				types.NamespacedName{Name: wskName},
				wsk,
			)).To(Succeed())

			Expect(wsk.Spec.FilterRules).To(BeComparableTo(
				[]kubefloworgv1beta1.FilterRule{newFilterRule(false)},
			))
		})

		It("should clear filterRules when omitted from update", func() {
			By("getting current data")
			getData := getWorkspaceKindData(wskName)
			Expect(getData.FilterRules).To(BeComparableTo(
				[]kubefloworgv1beta1.FilterRule{newFilterRule(false)},
			))

			By("setting filterRules to nil to simulate omission")
			getData.FilterRules = nil

			dataJSON, err := json.Marshal(getData)
			Expect(err).NotTo(HaveOccurred())
			updateBody := fmt.Sprintf(`{"data": %s}`, string(dataJSON))

			By("executing update")
			rr := doUpdate(wskName, updateBody)
			Expect(rr.Result().StatusCode).To(
				Equal(http.StatusOK),
				descUnexpectedHTTPStatus,
				rr.Body.String(),
			)

			By("verifying filterRules are cleared via GET")
			updatedData := getWorkspaceKindData(wskName)
			Expect(updatedData.FilterRules).To(BeEmpty())

			By("verifying the CRD was updated in Kubernetes")
			wsk := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(
				ctx,
				types.NamespacedName{Name: wskName},
				wsk,
			)).To(Succeed())
			Expect(wsk.Spec.FilterRules).To(BeEmpty())
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

			By("verifying the error response includes an internal conflict cause")
			var errorEnvelope ErrorEnvelope
			Expect(json.Unmarshal(rr.Body.Bytes(), &errorEnvelope)).To(Succeed())
			Expect(errorEnvelope.Error).NotTo(BeNil())
			Expect(errorEnvelope.Error.Cause).NotTo(BeNil())
			Expect(errorEnvelope.Error.Cause.ConflictCauses).To(HaveLen(1))
			Expect(errorEnvelope.Error.Cause.ConflictCauses[0].Origin).To(Equal(OriginInternal))
			Expect(errorEnvelope.Error.Cause.ConflictCauses[0].Message).NotTo(BeEmpty())
		})

		It("should return 415 for wrong Content-Type", func() {
			By("creating the HTTP request")
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, wskName, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(`{}`))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeYaml)
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: wskName},
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
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, wskName, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(`{invalid json`))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeJson)
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: wskName},
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
			path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, invalidName, 1)
			req, err := http.NewRequest(http.MethodPut, path, strings.NewReader(`{}`))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", constants.MediaTypeJson)
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateWorkspaceKindHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: invalidName},
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
