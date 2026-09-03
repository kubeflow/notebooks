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
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/namespaces"
)

var _ = Describe("Namespaces Handler", func() {

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("when namespaces exist", Serial, func() {

		const namespaceName1 = "get-ns-test-ns1"
		const namespaceName2 = "get-ns-test-ns2"

		BeforeEach(func() {
			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating Namespace 2")
			namespace2 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName2,
				},
			}
			Expect(k8sClient.Create(ctx, namespace2)).To(Succeed())
		})

		AfterEach(func() {
			By("deleting Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())

			By("deleting Namespace 2")
			namespace2 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName2,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace2)).To(Succeed())
		})

		It("should retrieve all namespaces successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, constants.AllNamespacesPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetNamespacesHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetNamespacesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to NamespaceListEnvelope")
			var response NamespaceListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the Namespaces from the Kubernetes API")
			namespace1 := &corev1.Namespace{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: namespaceName1}, namespace1)).To(Succeed())
			namespace2 := &corev1.Namespace{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: namespaceName2}, namespace2)).To(Succeed())

			By("ensuring the response contains the expected Namespaces")
			// NOTE: we use `ContainElements` instead of `ConsistOf` because envtest creates some namespaces by default
			Expect(response.Data).To(ContainElements(
				models.NewNamespaceModelFromNamespace(namespace1),
				models.NewNamespaceModelFromNamespace(namespace2),
			))
		})
	})

	// NOTE: envtest has no namespace controller, so deleted namespaces stay
	//       Terminating and their names cannot be reused. This context uses its
	//       own namespaces rather than sharing the ones above.
	Context("when the user can only use some namespaces", Serial, func() {

		const allowedNamespace = "get-ns-test-ns3"
		const deniedNamespace = "get-ns-test-ns4"
		const restrictedUser = "get-ns-test-user"

		BeforeEach(func() {
			for _, name := range []string{allowedNamespace, deniedNamespace} {
				Expect(k8sClient.Create(ctx, &corev1.Namespace{
					ObjectMeta: metav1.ObjectMeta{Name: name},
				})).To(Succeed())
			}

			By("granting the user access to the allowed namespace only")
			Expect(k8sClient.Create(ctx, &rbacv1.Role{
				ObjectMeta: metav1.ObjectMeta{Name: "get-ns-test-role", Namespace: allowedNamespace},
				Rules: []rbacv1.PolicyRule{{
					APIGroups: []string{"kubeflow.org"},
					Resources: []string{"workspaces"},
					Verbs:     []string{"list"},
				}},
			})).To(Succeed())
			Expect(k8sClient.Create(ctx, &rbacv1.RoleBinding{
				ObjectMeta: metav1.ObjectMeta{Name: "get-ns-test-binding", Namespace: allowedNamespace},
				Subjects:   []rbacv1.Subject{{Kind: "User", Name: restrictedUser, APIGroup: rbacv1.GroupName}},
				RoleRef: rbacv1.RoleRef{
					APIGroup: rbacv1.GroupName,
					Kind:     "Role",
					Name:     "get-ns-test-role",
				},
			})).To(Succeed())
		})

		// The namespace picker is the one place a user sees the shape of the
		// cluster, so it must not leak namespaces they cannot use.
		It("should only return namespaces the user can list workspaces in", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, constants.AllNamespacesPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set(userIdHeader, restrictedUser)

			By("executing GetNamespacesHandler")
			rr := httptest.NewRecorder()
			a.GetNamespacesHandler(rr, req, httprouter.Params{})
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())
			var response NamespaceListEnvelope
			Expect(json.Unmarshal(body, &response)).To(Succeed())

			By("ensuring only the granted namespace is returned")
			names := make([]string, len(response.Data))
			for i, ns := range response.Data {
				names[i] = ns.Name
			}
			Expect(names).To(ContainElement(allowedNamespace))
			Expect(names).NotTo(ContainElement(deniedNamespace))
		})
	})
})
