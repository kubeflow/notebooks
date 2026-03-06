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
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	commonModels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/storageclasses"
)

var _ = Describe("StorageClasses Handler", func() {

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("when storage classes exist", Serial, func() {

		const storageClassName1 = "get-sc-test-sc1"
		const storageClassName2 = "get-sc-test-sc2"

		BeforeEach(func() {
			By("creating StorageClass 1")
			storageClass1 := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName1,
					Labels: map[string]string{
						commonModels.LabelCanUse: "true",
					},
					Annotations: map[string]string{
						commonModels.AnnotationDisplayName: "Test Storage Class 1",
						commonModels.AnnotationDescription: "A test storage class",
					},
				},
				Provisioner: "kubernetes.io/no-provisioner",
			}
			Expect(k8sClient.Create(ctx, storageClass1)).To(Succeed())

			By("creating StorageClass 2")
			storageClass2 := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName2,
					Labels: map[string]string{
						commonModels.LabelCanUse: "true",
					},
					Annotations: map[string]string{
						commonModels.AnnotationDisplayName: "Test Storage Class 2",
						commonModels.AnnotationDescription: "Another test storage class",
					},
				},
				Provisioner: "kubernetes.io/no-provisioner",
			}
			Expect(k8sClient.Create(ctx, storageClass2)).To(Succeed())
		})

		AfterEach(func() {
			By("deleting StorageClass 1")
			storageClass1 := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName1,
				},
			}
			Expect(k8sClient.Delete(ctx, storageClass1)).To(Succeed())

			By("deleting StorageClass 2")
			storageClass2 := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName2,
				},
			}
			Expect(k8sClient.Delete(ctx, storageClass2)).To(Succeed())
		})

		It("should retrieve all storage classes successfully", func() {
			By("creating the HTTP request")
			req, err := http.NewRequest(http.MethodGet, AllStorageClassesPath, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetStorageClassesHandler")
			ps := httprouter.Params{}
			rr := httptest.NewRecorder()
			a.GetStorageClassesHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to StorageClassListEnvelope")
			var response StorageClassListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the StorageClasses from the Kubernetes API")
			storageClass1 := &storagev1.StorageClass{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: storageClassName1}, storageClass1)).To(Succeed())
			storageClass2 := &storagev1.StorageClass{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: storageClassName2}, storageClass2)).To(Succeed())

			By("ensuring the response contains the expected StorageClasses")
			// NOTE: we use `ContainElements` instead of `ConsistOf` because envtest may create some storage classes by default
			Expect(response.Data).To(ContainElements(
				models.NewStorageClassListItemFromStorageClass(storageClass1),
				models.NewStorageClassListItemFromStorageClass(storageClass2),
			))
		})
	})
})
