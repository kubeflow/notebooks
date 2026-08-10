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
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/podlogs"
)

var _ = Describe("Workspace Logs Handler", func() {

	// buildLogsRequest constructs the HTTP request and httprouter params for the
	// batch logs endpoint, applying the given raw query string (may be empty).
	buildLogsRequest := func(namespace, workspaceName, rawQuery string) (*http.Request, httprouter.Params) {
		path := strings.Replace(constants.WorkspacePodTemplatePodLogsBatchPath, ":"+constants.NamespacePathParam, namespace, 1)
		path = strings.Replace(path, ":"+constants.ResourceNamePathParam, workspaceName, 1)
		if rawQuery != "" {
			path += "?" + rawQuery
		}

		req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
		Expect(err).NotTo(HaveOccurred())
		req.Header.Set(userIdHeader, adminUser)

		ps := httprouter.Params{
			httprouter.Param{Key: constants.NamespacePathParam, Value: namespace},
			httprouter.Param{Key: constants.ResourceNamePathParam, Value: workspaceName},
		}
		return req, ps
	}

	Context("with invalid query parameters", func() {

		It("should return 422 when tailLines is not a positive integer", func() {
			By("creating the HTTP request with a non-integer tailLines")
			req, ps := buildLogsRequest("logs-ns", "workspace-logs", "tailLines=abc")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 422 Unprocessable Entity")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))

			By("verifying the error message indicates a query parameter validation failure")
			var response ErrorEnvelope
			Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())
			Expect(response.Error.Message).To(Equal(errMsgQueryParamsInvalid))
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(constants.TailLinesQueryParam))
		})

		It("should return 422 when tailLines is zero or negative", func() {
			By("creating the HTTP request with a non-positive tailLines")
			req, ps := buildLogsRequest("logs-ns", "workspace-logs", "tailLines=0")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 422 Unprocessable Entity")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))

			By("verifying the error message indicates a query parameter validation failure")
			var response ErrorEnvelope
			Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())
			Expect(response.Error.Message).To(Equal(errMsgQueryParamsInvalid))
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(constants.TailLinesQueryParam))
		})

		It("should return 422 when previous is not a boolean", func() {
			By("creating the HTTP request with a non-boolean previous")
			req, ps := buildLogsRequest("logs-ns", "workspace-logs", "previous=maybe")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 422 Unprocessable Entity")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))

			By("verifying the error message indicates a query parameter validation failure")
			var response ErrorEnvelope
			Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())
			Expect(response.Error.Message).To(Equal(errMsgQueryParamsInvalid))
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(constants.PreviousQueryParam))
		})

		It("should return 422 when sinceTime is not a valid RFC3339 timestamp", func() {
			By("creating the HTTP request with an invalid sinceTime")
			req, ps := buildLogsRequest("logs-ns", "workspace-logs", "sinceTime=not-a-timestamp")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 422 Unprocessable Entity")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))

			By("verifying the error message indicates a query parameter validation failure")
			var response ErrorEnvelope
			Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())
			Expect(response.Error.Message).To(Equal(errMsgQueryParamsInvalid))
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(constants.SinceTimeQueryParam))
		})

		It("should return 422 when container is not a valid DNS1123 label", func() {
			By("creating the HTTP request with an invalid container name")
			req, ps := buildLogsRequest("logs-ns", "workspace-logs", "container=BAD_NAME!")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 422 Unprocessable Entity")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))

			By("verifying the error message indicates a query parameter validation failure")
			var response ErrorEnvelope
			Expect(json.Unmarshal(rr.Body.Bytes(), &response)).To(Succeed())
			Expect(response.Error.Message).To(Equal(errMsgQueryParamsInvalid))
			Expect(response.Error.Cause.ValidationErrors).NotTo(BeEmpty())
			Expect(response.Error.Cause.ValidationErrors[0].Field).To(Equal(constants.ContainerQueryParam))
		})
	})

	Context("with a non-existent workspace", func() {

		It("should return 404 with a descriptive message when the workspace does not exist", func() {
			By("creating the HTTP request for a missing workspace")
			req, ps := buildLogsRequest("logs-ns", "does-not-exist", "")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 404 Not Found")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound))

			By("verifying the response carries the generic 'not found' message")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())
			var envelope ErrorEnvelope
			Expect(json.Unmarshal(body, &envelope)).To(Succeed())
			Expect(envelope.Error).NotTo(BeNil())
			Expect(envelope.Error.Message).To(Equal(errMsgNotFound))
		})
	})

	Context("with an existing Workspace that has no running pod", Serial, Ordered, func() {
		const namespaceName = "logs-nopod-ns"
		var (
			workspaceName     string
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "logs-nopod-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

			By("creating the Namespace")
			Expect(k8sClient.Create(ctx, &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			})).To(Succeed())

			By("creating the WorkspaceKind")
			Expect(k8sClient.Create(ctx, NewExampleWorkspaceKind(workspaceKindName))).To(Succeed())

			By("creating the Workspace (status.podTemplatePod.name is empty)")
			Expect(k8sClient.Create(ctx, NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName))).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			})).To(Succeed())

			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			})).To(Succeed())

			By("deleting the Namespace")
			Expect(k8sClient.Delete(ctx, &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			})).To(Succeed())
		})

		It("should return 400 when the workspace pod is not running", func() {
			By("creating the HTTP request")
			req, ps := buildLogsRequest(namespaceName, workspaceName, "")

			By("executing GetWorkspacePodTemplateLogsHandler")
			rr := httptest.NewRecorder()
			a.GetWorkspacePodTemplateLogsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying status is 400 Bad Request")
			Expect(rs.StatusCode).To(Equal(http.StatusBadRequest))

			By("verifying the response carries the specific 'workspace pod is not running' message")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())
			var envelope ErrorEnvelope
			Expect(json.Unmarshal(body, &envelope)).To(Succeed())
			Expect(envelope.Error).NotTo(BeNil())
			Expect(envelope.Error.Message).To(Equal(repository.ErrPodNotRunning.Error()))
		})
	})
})
