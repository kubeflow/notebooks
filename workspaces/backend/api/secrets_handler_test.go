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
	"time"

	"github.com/julienschmidt/httprouter"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/secrets"
)

// TODO: Fix tests to not rely on mocked data once repository implementation is ready
var _ = Describe("Secrets Handler", func() {

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("when secrets exist", Serial, func() {

		const secretName1 = "test-secret-1"
		const secretName2 = "test-secret-2"
		var namespaceName string

		BeforeEach(func() {
			namespaceName = "secrets-test-ns-" + fmt.Sprintf("%d", time.Now().UnixNano())
			By("creating test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating Secret 1")
			secret1 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName1,
					Namespace: namespaceName,
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"username": []byte("testuser"),
					"password": []byte("testpass"),
				},
			}
			Expect(k8sClient.Create(ctx, secret1)).To(Succeed())

			By("creating Secret 2")
			secret2 := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName2,
					Namespace: namespaceName,
				},
				Type: corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"api-key": []byte("test-api-key"),
				},
			}
			Expect(k8sClient.Create(ctx, secret2)).To(Succeed())
		})

		AfterEach(func() {
			By("deleting test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should retrieve all secrets in namespace successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, "/api/v1/secrets/"+namespaceName, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretsHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
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

			By("ensuring the response contains the expected secrets")
			// NOTE: Currently returns mock data as stub implementation
			Expect(response.Data).To(HaveLen(3))
		})

		It("should return 200 for mock secret", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, "/api/v1/secrets/"+namespaceName+"/database-credentials", http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
				{Key: ResourceNamePathParam, Value: "database-credentials"},
			}
			rr := httptest.NewRecorder()
			a.GetSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 404 for non-existent secret", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, "/api/v1/secrets/"+namespaceName+"/non-existent", http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
				{Key: ResourceNamePathParam, Value: "non-existent"},
			}
			rr := httptest.NewRecorder()
			a.GetSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	Context("when creating secrets", Serial, func() {
		var namespaceName string

		BeforeEach(func() {
			namespaceName = "secrets-create-test-ns-" + fmt.Sprintf("%d", time.Now().UnixNano())
			By("creating test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())
		})

		AfterEach(func() {
			By("deleting test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should return 201 for create secret (mock implementation)", func() {
			By("creating the HTTP request body")
			createReq := models.NewSecretCreate(
				"test-secret",
				"Opaque",
				false,
				models.SecretData{
					"username": {Base64: ptr.To("dGVzdHVzZXI=")}, // base64 for "testuser"
					"password": {Base64: ptr.To("dGVzdHBhc3M=")}, // base64 for "testpass"
				},
			)
			bodyEnvelope := SecretCreateEnvelope{Data: &createReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, "/api/v1/secrets/"+namespaceName, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusCreated), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 400 for invalid request body", func() {
			By("creating the HTTP request with invalid JSON")
			req, err := http.NewRequest(http.MethodPost, "/api/v1/secrets/"+namespaceName, bytes.NewBufferString("invalid json"))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 422 for missing name", func() {
			By("creating the HTTP request body without name")
			createReq := models.NewSecretCreate(
				"", // empty name to trigger validation error
				"Opaque",
				false,
				models.SecretData{
					"username": {Base64: ptr.To("dGVzdHVzZXI=")}, // base64 for "testuser"
				},
			)
			bodyEnvelope := SecretCreateEnvelope{Data: &createReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPost, "/api/v1/secrets/"+namespaceName, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreateSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
			}
			rr := httptest.NewRecorder()
			a.CreateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	Context("when updating secrets", Serial, func() {
		var namespaceName string

		BeforeEach(func() {
			namespaceName = "secrets-update-test-ns-" + fmt.Sprintf("%d", time.Now().UnixNano())
			By("creating test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())
		})

		AfterEach(func() {
			By("deleting test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should return 200 for update secret (mock implementation)", func() {
			By("creating the HTTP request body")
			updateReq := models.NewSecretUpdate(
				"Opaque",
				false,
				models.SecretData{
					"username": {Base64: ptr.To("dXBkYXRlZHVzZXI=")}, // base64 for "updateduser"
					"password": {Base64: ptr.To("dXBkYXRlZHBhc3M=")}, // base64 for "updatedpass"
				},
			)
			bodyEnvelope := SecretEnvelope{Data: &updateReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPut, "/api/v1/secrets/"+namespaceName+"/database-credentials", bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
				{Key: ResourceNamePathParam, Value: "database-credentials"},
			}
			rr := httptest.NewRecorder()
			a.UpdateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 404 for update non-existent secret", func() {
			By("creating the HTTP request body")
			updateReq := models.NewSecretUpdate(
				"Opaque",
				false,
				models.SecretData{
					"username": {Base64: ptr.To("dXBkYXRlZHVzZXI=")}, // base64 for "updateduser"
					"password": {Base64: ptr.To("dXBkYXRlZHBhc3M=")}, // base64 for "updatedpass"
				},
			)
			bodyEnvelope := SecretEnvelope{Data: &updateReq}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodPut, "/api/v1/secrets/"+namespaceName+"/non-existent", bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing UpdateSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
				{Key: ResourceNamePathParam, Value: "non-existent"},
			}
			rr := httptest.NewRecorder()
			a.UpdateSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	Context("when deleting secrets", Serial, func() {
		var namespaceName string

		BeforeEach(func() {
			namespaceName = "secrets-delete-test-ns-" + fmt.Sprintf("%d", time.Now().UnixNano())
			By("creating test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())
		})

		AfterEach(func() {
			By("deleting test namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should return 204 for delete secret (mock implementation)", func() {
			By("creating the HTTP request")
			// Use a mock secret name that exists in the mock data
			req, err := http.NewRequest(http.MethodDelete, "/api/v1/secrets/"+namespaceName+"/database-credentials", http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
				{Key: ResourceNamePathParam, Value: "database-credentials"},
			}
			rr := httptest.NewRecorder()
			a.DeleteSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNoContent), descUnexpectedHTTPStatus, rr.Body.String())
		})

		It("should return 404 for delete non-existent secret", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodDelete, "/api/v1/secrets/"+namespaceName+"/non-existent", http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeleteSecretHandler")
			ps := httprouter.Params{
				{Key: NamespacePathParam, Value: namespaceName},
				{Key: ResourceNamePathParam, Value: "non-existent"},
			}
			rr := httptest.NewRecorder()
			a.DeleteSecretHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})
})
