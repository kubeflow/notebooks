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
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/julienschmidt/httprouter"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
)

var _ = Describe("Workspace Details Handler", func() {
	Context("when querying workspace podtemplate details", func() {
		const testNamespace = "ns-details-test"
		const testWorkspace = "my-workspace"

		It("should return 404 when workspace does not exist", func() {
			By("creating the HTTP request for podtemplate details")
			path := strings.Replace(constants.WorkspacePodTemplateDetailsPath, ":"+constants.NamespacePathParam, testNamespace, 1)
			path = strings.Replace(path, ":"+constants.ResourceNamePathParam, testWorkspace, 1)

			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the authentication headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetWorkspaceDetailsHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: constants.NamespacePathParam, Value: testNamespace},
				httprouter.Param{Key: constants.ResourceNamePathParam, Value: testWorkspace},
			}
			rr := httptest.NewRecorder()
			a.GetWorkspaceDetailsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code is 404 (since resource is missing from environment)")
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
			a.GetWorkspaceDetailsHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code is 422 due to validation failure")
			Expect(rs.StatusCode).To(Equal(http.StatusUnprocessableEntity))
		})
	})
})
