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

	"github.com/julienschmidt/httprouter"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
)

var _ = Describe("Authz Check Handler", func() {

	// checkPath simulates the data plane's authorization request: the original
	// request path arrives appended to the endpoint's prefix.
	checkPath := func(originalPath, userID string) *httptest.ResponseRecorder {
		req, err := http.NewRequest(http.MethodGet, constants.AuthzCheckPathPrefix+originalPath, http.NoBody)
		Expect(err).NotTo(HaveOccurred())
		if userID != "" {
			req.Header.Set(userIdHeader, userID)
		}

		rr := httptest.NewRecorder()
		ps := httprouter.Params{{Key: constants.OriginalPathParam, Value: originalPath}}
		a.AuthzCheckHandler(rr, req, ps)
		return rr
	}

	Context("for non-workspace paths", func() {
		It("should allow any authenticated identity", func() {
			rr := checkPath("/workspaces/", "some-user")
			Expect(rr.Code).To(Equal(http.StatusOK), rr.Body.String())

			By("returning the verified identity for the data plane to copy upstream")
			Expect(rr.Header().Get(userIdHeader)).To(Equal("some-user"))
		})

		It("should reject an unauthenticated request", func() {
			rr := checkPath("/workspaces/", "")
			Expect(rr.Code).To(Equal(http.StatusUnauthorized), rr.Body.String())
		})
	})

	// NOTE: envtest has no namespace controller, so namespaces cannot be
	// deleted and recreated; Ordered with BeforeAll creates them exactly once.
	Context("for workspace connect paths", Serial, Ordered, func() {

		const namespaceName = "authz-check-test-ns"
		const allowedUser = "authz-check-test-user"

		BeforeAll(func() {
			By("creating the Namespace")
			Expect(k8sClient.Create(ctx, &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
			})).To(Succeed())

			By("granting the user access to workspaces in it")
			Expect(k8sClient.Create(ctx, &rbacv1.Role{
				ObjectMeta: metav1.ObjectMeta{Name: "authz-check-test-role", Namespace: namespaceName},
				Rules: []rbacv1.PolicyRule{{
					APIGroups: []string{"kubeflow.org"},
					Resources: []string{"workspaces"},
					Verbs:     []string{"get"},
				}},
			})).To(Succeed())
			Expect(k8sClient.Create(ctx, &rbacv1.RoleBinding{
				ObjectMeta: metav1.ObjectMeta{Name: "authz-check-test-binding", Namespace: namespaceName},
				Subjects:   []rbacv1.Subject{{Kind: "User", Name: allowedUser, APIGroup: rbacv1.GroupName}},
				RoleRef: rbacv1.RoleRef{
					APIGroup: rbacv1.GroupName,
					Kind:     "Role",
					Name:     "authz-check-test-role",
				},
			})).To(Succeed())
		})

		It("should allow a user who can get the workspace", func() {
			rr := checkPath("/workspace/connect/"+namespaceName+"/my-ws/jupyterlab/lab", allowedUser)
			Expect(rr.Code).To(Equal(http.StatusOK), rr.Body.String())
		})

		// A workspace connect path is proxied straight to the notebook pod, so
		// authentication alone must not be enough.
		It("should deny an authenticated user without access", func() {
			rr := checkPath("/workspace/connect/"+namespaceName+"/my-ws/jupyterlab/lab", "some-other-user")
			Expect(rr.Code).To(Equal(http.StatusForbidden), rr.Body.String())
		})

		It("should reject a traversal path without consulting RBAC", func() {
			rr := checkPath("/workspace/connect/../"+namespaceName+"/my-ws/jupyterlab/", adminUser)
			Expect(rr.Code).To(Equal(http.StatusBadRequest), rr.Body.String())
		})
	})
})
