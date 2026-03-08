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

	commonModels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/secrets"
)

var _ = Describe("Secrets Handler", func() {

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing secrets", Serial, Ordered, func() {

		const (
			namespaceName1 = "secret-exist-ns1"
			secretName1    = "secret-exist-1"
			secretName2    = "secret-exist-2"
			secretName3    = "secret-exist-3"
		)

		BeforeAll(func() {
			By("creating Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating Secret 1 with can-mount and can-update labels")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName1,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"username": []byte("testuser"),
					"password": []byte("testpass"),
				},
			}
			Expect(k8sClient.Create(ctx, secret1)).To(Succeed())

			By("creating Secret 2 with can-mount only (no can-update)")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName2,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"api-key": []byte("test-api-key"),
				},
			}
			Expect(k8sClient.Create(ctx, secret2)).To(Succeed())

			By("creating Secret 3 with no labels")
			secret3 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName3,
					Namespace: namespaceName1,
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"token": []byte("test-token"),
				},
			}
			Expect(k8sClient.Create(ctx, secret3)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting Secret 1")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, secret1)).To(Succeed())

			By("deleting Secret 2")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName2,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, secret2)).To(Succeed())

			By("deleting Secret 3")
			secret3 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName3,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, secret3)).To(Succeed())

			By("deleting Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should list all secrets in namespace successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetSecretsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to SecretListEnvelope")
			var response SecretListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring the response contains the expected number of secrets")
			// NOTE: envtest may create default service account tokens, so we check at least our 3
			var foundNames []string
			for _, s := range response.Data {
				if s.Name == secretName1 || s.Name == secretName2 || s.Name == secretName3 {
					foundNames = append(foundNames, s.Name)
				}
			}
			Expect(foundNames).To(ConsistOf(secretName1, secretName2, secretName3))
		})

		It("should show correct labels in list response", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetSecretsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			var response SecretListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("finding secret 1 and verifying labels")
			for _, s := range response.Data {
				switch s.Name {
				case secretName1:
					Expect(s.CanMount).To(BeTrue())
					Expect(s.CanUpdate).To(BeTrue())
				case secretName2:
					Expect(s.CanMount).To(BeTrue())
					Expect(s.CanUpdate).To(BeFalse())
				case secretName3:
					Expect(s.CanMount).To(BeFalse())
					Expect(s.CanUpdate).To(BeFalse())
				}
			}
		})

		It("should return mounts as empty array when no workspaces reference secret", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetSecretsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			var response SecretListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("verifying mounts is empty array (not nil) for each secret")
			for _, s := range response.Data {
				if s.Name == secretName1 || s.Name == secretName2 || s.Name == secretName3 {
					Expect(s.Mounts).NotTo(BeNil())
					Expect(s.Mounts).To(BeEmpty())
				}
			}
		})

		It("should return 200 for getting a specific secret", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, secretName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: secretName1},
			}
			rr := httptest.NewRecorder()
			a.GetSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to SecretEnvelope")
			var response SecretEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring the response does not contain actual secret values")
			Expect(response.Data).NotTo(BeNil())
			Expect(response.Data.Type).To(Equal("Opaque"))
			for _, v := range response.Data.Contents {
				Expect(v.Base64).To(BeNil(), "secret values should never be returned")
			}
		})

		It("should return 404 for non-existent secret", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, "non-existent", 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: "non-existent"},
			}
			rr := httptest.NewRecorder()
			a.GetSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with secret cross-references", Serial, Ordered, func() {

		const (
			namespaceName1     = "secret-xref-ns1"
			secretName1        = "secret-xref-1"
			secretName2        = "secret-xref-2"
			workspaceKindName1 = "wsk-secret-xref-1"
			workspaceName1     = "ws-secret-xref-1"
		)

		BeforeAll(func() {
			By("creating Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating Secret 1")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName1,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"key": []byte("value"),
				},
			}
			Expect(k8sClient.Create(ctx, secret1)).To(Succeed())

			By("creating Secret 2 (not referenced)")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName2,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"data": []byte("value"),
				},
			}
			Expect(k8sClient.Create(ctx, secret2)).To(Succeed())

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName1)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace that mounts Secret 1")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName1,
					Namespace: namespaceName1,
				},
				Spec: kubefloworgv1beta1.WorkspaceSpec{
					Paused: ptr.To(false),
					Kind:   workspaceKindName1,
					PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
						Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
							Home: ptr.To("my-home-pvc"),
							Secrets: []kubefloworgv1beta1.PodSecretMount{
								{
									SecretName: secretName1,
									MountPath:  "/secrets/secret-1",
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
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName1,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())

			By("deleting Secret 1")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, secret1)).To(Succeed())

			By("deleting Secret 2")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName2,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, secret2)).To(Succeed())

			By("deleting Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should include workspace cross-reference for mounted secret", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetSecretsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			var response SecretListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("finding Secret 1 and verifying mount cross-reference")
			var secret1Response *models.SecretListItem
			for i := range response.Data {
				if response.Data[i].Name == secretName1 {
					secret1Response = &response.Data[i]
					break
				}
			}
			Expect(secret1Response).NotTo(BeNil(), "Secret 1 should be present in the response")
			Expect(secret1Response.Mounts).To(HaveLen(1))
			Expect(secret1Response.Mounts[0]).To(BeComparableTo(models.SecretMount{
				Group: "kubeflow.org",
				Kind:  "Workspace",
				Name:  workspaceName1,
			}))

			By("finding Secret 2 and verifying no cross-references")
			var secret2Response *models.SecretListItem
			for i := range response.Data {
				if response.Data[i].Name == secretName2 {
					secret2Response = &response.Data[i]
					break
				}
			}
			Expect(secret2Response).NotTo(BeNil(), "Secret 2 should be present in the response")
			Expect(secret2Response.Mounts).To(BeEmpty())
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("when creating secrets", Serial, Ordered, func() {

		const (
			namespaceName1   = "secret-create-ns1"
			secretCreateName = "test-create-secret"
		)

		BeforeAll(func() {
			By("creating Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting test secret if it exists")
			secret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretCreateName,
					Namespace: namespaceName1,
				},
			}
			err := k8sClient.Delete(ctx, secret)
			if err != nil && !apierrors.IsNotFound(err) {
				Expect(err).NotTo(HaveOccurred())
			}

			By("deleting Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should create a secret successfully", func() {
			By("creating the HTTP request body")
			secretCreate := models.NewSecretCreate(
				secretCreateName,
				"Opaque",
				false,
				models.SecretData{
					"username": {Base64: ptr.To("dGVzdHVzZXI=")},
					"password": {Base64: ptr.To("dGVzdHBhc3M=")},
				},
			)
			bodyEnvelope := SecretCreateEnvelope{Data: &secretCreate}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusCreated), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to SecretCreateEnvelope")
			var response SecretCreateEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring the response never contains secret values")
			Expect(response.Data).NotTo(BeNil())
			Expect(response.Data.Name).To(Equal(secretCreateName))
			Expect(response.Data.Type).To(Equal("Opaque"))
			Expect(response.Data.Immutable).To(BeFalse())
			for _, v := range response.Data.Contents {
				Expect(v.Base64).To(BeNil(), "secret values should never be returned in create response")
			}

			By("verifying the secret was created in Kubernetes with expected labels")
			createdSecret := &corev1.Secret{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: secretCreateName, Namespace: namespaceName1}, createdSecret)).To(Succeed())
			Expect(createdSecret.Labels[commonModels.LabelCanMount]).To(Equal("true"))
			Expect(createdSecret.Labels[commonModels.LabelCanUpdate]).To(Equal("true"))

			By("verifying the secret has audit annotations")
			Expect(createdSecret.Annotations[commonModels.AnnotationCreatedBy]).NotTo(BeEmpty())
			Expect(createdSecret.Annotations[commonModels.AnnotationUpdatedBy]).NotTo(BeEmpty())

			By("verifying the secret data was stored correctly")
			Expect(createdSecret.Data).To(HaveKey("username"))
			Expect(createdSecret.Data).To(HaveKey("password"))
		})

		It("should return 409 for duplicate secret name", func() {
			By("creating the HTTP request body with same name")
			secretCreate := models.NewSecretCreate(
				secretCreateName,
				"Opaque",
				false,
				models.SecretData{
					"key": {Base64: ptr.To("dmFsdWU=")},
				},
			)
			bodyEnvelope := SecretCreateEnvelope{Data: &secretCreate}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusConflict), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 for missing name", func() {
			By("creating the HTTP request body without name")
			secretCreate := models.NewSecretCreate(
				"",
				"Opaque",
				false,
				models.SecretData{
					"key": {Base64: ptr.To("dmFsdWU=")},
				},
			)
			bodyEnvelope := SecretCreateEnvelope{Data: &secretCreate}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 for nil data envelope", func() {
			By("creating the HTTP request body with nil data")
			reqBody := []byte(`{"data": null}`)

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 400 for invalid request body", func() {
			By("creating the HTTP request with invalid JSON")
			req, err := http.NewRequest(http.MethodPost, "/api/v1/secrets/"+namespaceName1, bytes.NewBufferString("invalid json"))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("when updating secrets", Serial, Ordered, func() {

		const (
			namespaceName1     = "secret-update-ns1"
			secretUpdatable    = "secret-updatable"
			secretNotUpdatable = "secret-not-updatable"
		)

		BeforeAll(func() {
			By("creating Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating an updatable Secret")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretUpdatable,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"username": []byte("original-user"),
					"password": []byte("original-pass"),
					"host":     []byte("original-host"),
				},
			}
			Expect(k8sClient.Create(ctx, secret1)).To(Succeed())

			By("creating a non-updatable Secret (no can-update label)")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretNotUpdatable,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"key": []byte("value"),
				},
			}
			Expect(k8sClient.Create(ctx, secret2)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting secrets")
			for _, name := range []string{secretUpdatable, secretNotUpdatable} {
				secret := &corev1.Secret{
					ObjectMeta: metav1.ObjectMeta{
						Name:      name,
						Namespace: namespaceName1,
					},
				}
				err := k8sClient.Delete(ctx, secret)
				if err != nil && !apierrors.IsNotFound(err) {
					Expect(err).NotTo(HaveOccurred())
				}
			}

			By("deleting Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should update secret values successfully", func() {
			By("creating the HTTP request body")
			updateReq := models.NewSecretUpdate(
				"Opaque",
				false,
				models.SecretData{
					// "username": preserve existing value (Base64 is nil)
					"username": {},
					// "password": update with new value
					"password": {Base64: ptr.To("bmV3cGFzcw==")},
					// "newkey": add new key
					"newkey": {Base64: ptr.To("bmV3a2V5dmFsdWU=")},
					// "host": omitted from request, should be deleted
				},
			)
			bodyEnvelope := SecretEnvelope{Data: &updateReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, secretUpdatable, 1)
			req, err := http.NewRequest(http.MethodPut, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: secretUpdatable},
			}
			rr := httptest.NewRecorder()
			a.UpdateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON")
			var response SecretEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring the response never contains secret values")
			Expect(response.Data).NotTo(BeNil())
			for _, v := range response.Data.Contents {
				Expect(v.Base64).To(BeNil(), "secret values should never be returned in update response")
			}

			By("verifying the secret was updated correctly in Kubernetes")
			updatedSecret := &corev1.Secret{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: secretUpdatable, Namespace: namespaceName1}, updatedSecret)).To(Succeed())

			// "username" should be preserved (original value)
			Expect(updatedSecret.Data).To(HaveKey("username"))
			Expect(string(updatedSecret.Data["username"])).To(Equal("original-user"))

			// "password" should be updated
			Expect(updatedSecret.Data).To(HaveKey("password"))
			Expect(string(updatedSecret.Data["password"])).To(Equal("bmV3cGFzcw=="))

			// "newkey" should be added
			Expect(updatedSecret.Data).To(HaveKey("newkey"))
			Expect(string(updatedSecret.Data["newkey"])).To(Equal("bmV3a2V5dmFsdWU="))

			// "host" should be deleted (was omitted from request)
			Expect(updatedSecret.Data).NotTo(HaveKey("host"))
		})

		It("should return 400 when secret lacks can-update label", func() {
			By("creating the HTTP request body")
			updateReq := models.NewSecretUpdate(
				"Opaque",
				false,
				models.SecretData{
					"key": {Base64: ptr.To("dmFsdWU=")},
				},
			)
			bodyEnvelope := SecretEnvelope{Data: &updateReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, secretNotUpdatable, 1)
			req, err := http.NewRequest(http.MethodPut, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: secretNotUpdatable},
			}
			rr := httptest.NewRecorder()
			a.UpdateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 404 for updating non-existent secret", func() {
			By("creating the HTTP request body")
			updateReq := models.NewSecretUpdate(
				"Opaque",
				false,
				models.SecretData{
					"key": {Base64: ptr.To("dmFsdWU=")},
				},
			)
			bodyEnvelope := SecretEnvelope{Data: &updateReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, "non-existent", 1)
			req, err := http.NewRequest(http.MethodPut, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: "non-existent"},
			}
			rr := httptest.NewRecorder()
			a.UpdateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("when deleting secrets", Serial, Ordered, func() {

		const (
			namespaceName1     = "secret-delete-ns1"
			secretDeletable    = "secret-deletable"
			secretNotDeletable = "secret-not-deletable"
		)

		BeforeAll(func() {
			By("creating Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating a deletable Secret (with can-update label)")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretDeletable,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"key": []byte("value"),
				},
			}
			Expect(k8sClient.Create(ctx, secret1)).To(Succeed())

			By("creating a non-deletable Secret (no can-update label)")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretNotDeletable,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount: "true",
					},
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"key": []byte("value"),
				},
			}
			Expect(k8sClient.Create(ctx, secret2)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting non-deletable secret")
			secret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretNotDeletable,
					Namespace: namespaceName1,
				},
			}
			err := k8sClient.Delete(ctx, secret)
			if err != nil && !apierrors.IsNotFound(err) {
				Expect(err).NotTo(HaveOccurred())
			}

			By("deleting Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should delete a secret with can-update label successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, secretDeletable, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: secretDeletable},
			}
			rr := httptest.NewRecorder()
			a.DeleteSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNoContent), descUnexpectedHTTPStatus, rr.Body.String())

			By("verifying the secret was deleted from Kubernetes")
			deletedSecret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: secretDeletable, Namespace: namespaceName1}, deletedSecret)
			Expect(apierrors.IsNotFound(err)).To(BeTrue())
		})

		It("should return 400 when secret lacks can-update label", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, secretNotDeletable, 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: secretNotDeletable},
			}
			rr := httptest.NewRecorder()
			a.DeleteSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 404 for deleting non-existent secret", func() {
			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, "non-existent", 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteSecretHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: "non-existent"},
			}
			rr := httptest.NewRecorder()
			a.DeleteSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing secrets", Serial, func() {

		It("should return an empty list of secrets for a non-existent namespace", func() {
			missingNamespace := "non-existent-secret-ns"

			By("creating the HTTP request")
			path := strings.Replace(SecretsByNamespacePath, ":"+NamespacePathParam, missingNamespace, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: missingNamespace},
			}
			rr := httptest.NewRecorder()
			a.GetSecretsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to SecretListEnvelope")
			var response SecretListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that no secrets were returned")
			Expect(response.Data).To(BeEmpty())
		})
	})
})
