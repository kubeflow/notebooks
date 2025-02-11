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
	"io"
	"net/http"
	"net/http/httptest"

	"github.com/julienschmidt/httprouter"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/health_check"
)

var _ = Describe("HealthCheck Handler", func() {

	Context("when backend is healthy", func() {

		It("should return a health check response", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, HealthCheckPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("executing GetHealthCheckHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetHealthcheckHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK))

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to HealthCheck")
			var response models.HealthCheck
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that the health check is as expected")
			expected := models.HealthCheck{
				Status: models.ServiceStatusHealthy,
				SystemInfo: models.SystemInfo{
					Version: Version,
				},
			}
			Expect(response).To(BeComparableTo(expected))
		})
	})
})
