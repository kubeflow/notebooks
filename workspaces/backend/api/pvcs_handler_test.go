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
	storagev1 "k8s.io/api/storage/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	commonModels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/pvcs"
)

var _ = Describe("PVCs Handler", func() {

	//
	// TODO: add test which fails when CREATING a PVC that references a StorageClass that does not
	//       have the `notebooks.kubeflow.org/can-use=true` label.
	//
	//
	// TODO: add test which fails when DELETING a PVC that does not
	//       have the `notebooks.kubeflow.org/can-update=true` label.
	//

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with existing PVCs", Serial, Ordered, func() {

		const namespaceName1 = "pvc-exist-ns1"

		var (
			pvcName1 string
			pvcKey1  types.NamespacedName
			pvcName2 string
			pvcKey2  types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "pvc-exist-test"
			pvcName1 = fmt.Sprintf("pvc-1-%s", uniqueName)
			pvcKey1 = types.NamespacedName{Name: pvcName1, Namespace: namespaceName1}
			pvcName2 = fmt.Sprintf("pvc-2-%s", uniqueName)
			pvcKey2 = types.NamespacedName{Name: pvcName2, Namespace: namespaceName1}

			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating PVC 1 in Namespace 1")
			pvc1 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName1,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{
						corev1.ReadWriteOnce,
					},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceStorage: resource.MustParse("10Gi"),
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pvc1)).To(Succeed())

			By("creating PVC 2 in Namespace 1")
			pvc2 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName2,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount: "true",
					},
				},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{
						corev1.ReadWriteMany,
					},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceStorage: resource.MustParse("5Gi"),
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pvc2)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting PVC 1 from Namespace 1")
			pvc1 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pvc1)).To(Succeed())

			By("deleting PVC 2 from Namespace 1")
			pvc2 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName2,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pvc2)).To(Succeed())

			By("deleting Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())
		})

		It("should retrieve PVCs from Namespace 1 successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetPVCsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetPVCsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCListEnvelope")
			var response PVCListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("getting the PVCs from the Kubernetes API")
			pvc1 := &corev1.PersistentVolumeClaim{}
			Expect(k8sClient.Get(ctx, pvcKey1, pvc1)).To(Succeed())
			pvc2 := &corev1.PersistentVolumeClaim{}
			Expect(k8sClient.Get(ctx, pvcKey2, pvc2)).To(Succeed())

			By("ensuring the response contains the expected PVCs")
			Expect(response.Data).To(ConsistOf(
				models.NewPVCListItemFromPVC(pvc1, nil, nil, nil, nil),
				models.NewPVCListItemFromPVC(pvc2, nil, nil, nil, nil),
			))
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("when creating PVCs", Serial, Ordered, func() {

		const (
			namespaceName1   = "pvc-create-ns1"
			storageClassName = "standard"
			pvcCreateName    = "test-create-pvc"
		)

		BeforeAll(func() {
			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating the StorageClass")
			sc := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName,
					Labels: map[string]string{
						commonModels.LabelCanUse: "true",
					},
				},
				Provisioner: "kubernetes.io/no-provisioner",
			}
			Expect(k8sClient.Create(ctx, sc)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting test PVC")
			pvc := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcCreateName,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pvc)).To(Succeed())

			By("deleting the StorageClass")
			sc := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName,
				},
			}
			Expect(k8sClient.Delete(ctx, sc)).To(Succeed())

			By("deleting Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())
		})

		It("should create a PVC successfully", func() {
			By("creating the HTTP request body")
			pvcCreate := &models.PVCCreate{
				Name:             pvcCreateName,
				AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
				StorageClassName: storageClassName,
				Requests: models.StorageRequestsMutate{
					Storage: "10Gi",
				},
			}
			bodyEnvelope := PVCCreateEnvelope{Data: pvcCreate}
			reqBody, err := json.Marshal(bodyEnvelope)
			Expect(err).NotTo(HaveOccurred())

			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodPost, path, bytes.NewBuffer(reqBody))
			Expect(err).NotTo(HaveOccurred())
			req.Header.Set("Content-Type", "application/json")

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing CreatePVCHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.CreatePVCHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusCreated), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCCreateEnvelope")
			var response PVCCreateEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring the response contains the expected PVC data")
			Expect(response.Data).To(BeComparableTo(pvcCreate))

			By("verifying the PVC was created in Kubernetes with the expected labels")
			createdPVC := &corev1.PersistentVolumeClaim{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: "test-create-pvc", Namespace: namespaceName1}, createdPVC)).To(Succeed())
			Expect(createdPVC.Labels[commonModels.LabelCanMount]).To(Equal("true"))
			Expect(createdPVC.Labels[commonModels.LabelCanUpdate]).To(Equal("true"))
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("when deleting PVCs", Serial, Ordered, func() {

		const namespaceName1 = "pvc-delete-ns1"

		BeforeAll(func() {
			By("creating Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace1)).To(Succeed())

			By("creating a PVC to be deleted")
			pvc := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-delete-pvc",
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{
						corev1.ReadWriteOnce,
					},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceStorage: resource.MustParse("10Gi"),
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pvc)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting Namespace 1")
			namespace1 := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace1)).To(Succeed())
		})

		It("should delete a PVC successfully", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, "test-delete-pvc", 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeletePVCHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: "test-delete-pvc"},
			}
			rr := httptest.NewRecorder()
			a.DeletePVCHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNoContent), descUnexpectedHTTPStatus, rr.Body.String())

			By("ensuring the PVC has been deleted or is being deleted")
			deletedPVC := &corev1.PersistentVolumeClaim{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: "test-delete-pvc", Namespace: namespaceName1}, deletedPVC)
			if err != nil {
				Expect(apierrors.IsNotFound(err)).To(BeTrue())
			} else {
				// in envtest, PVCs may have finalizers preventing immediate deletion
				Expect(deletedPVC.DeletionTimestamp).NotTo(BeNil())
			}
		})

		It("should return 404 for deleting a non-existent PVC", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamePath, ":"+NamespacePathParam, namespaceName1, 1)
			path = strings.Replace(path, ":"+ResourceNamePathParam, "non-existent-pvc", 1)
			req, err := http.NewRequest(http.MethodDelete, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing DeletePVCHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
				httprouter.Param{Key: ResourceNamePathParam, Value: "non-existent-pvc"},
			}
			rr := httptest.NewRecorder()
			a.DeletePVCHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusNotFound), descUnexpectedHTTPStatus, rr.Body.String())
		})
	})

	// NOTE: the tests in this context work on the same resources, they must be run in order.
	//       also, they assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Ordered` and `Serial` Ginkgo decorators.
	Context("with PVC cross-references", Serial, Ordered, func() {

		const (
			namespaceName1     = "pvc-xref-ns1"
			pvcName1           = "pvc-xref-1"
			pvcName2           = "pvc-xref-2"
			pvName1            = "pv-xref-1"
			storageClassName1  = "sc-xref-1"
			podName1           = "pod-xref-1"
			workspaceKindName1 = "wsk-xref-1"
			workspaceName1     = "ws-xref-1"
		)

		BeforeAll(func() {
			By("creating Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

			By("creating StorageClass with annotations")
			reclaimPolicy := corev1.PersistentVolumeReclaimDelete
			sc := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName1,
					Annotations: map[string]string{
						commonModels.AnnotationDisplayName: "Test Storage",
						commonModels.AnnotationDescription: "A test storage class",
					},
				},
				Provisioner:   "kubernetes.io/no-provisioner",
				ReclaimPolicy: &reclaimPolicy,
			}
			Expect(k8sClient.Create(ctx, sc)).To(Succeed())

			By("creating PersistentVolume")
			volumeMode := corev1.PersistentVolumeFilesystem
			pv := &corev1.PersistentVolume{
				ObjectMeta: metav1.ObjectMeta{
					Name: pvName1,
				},
				Spec: corev1.PersistentVolumeSpec{
					Capacity: corev1.ResourceList{
						corev1.ResourceStorage: resource.MustParse("10Gi"),
					},
					AccessModes: []corev1.PersistentVolumeAccessMode{
						corev1.ReadWriteOnce,
					},
					PersistentVolumeReclaimPolicy: corev1.PersistentVolumeReclaimDelete,
					StorageClassName:              storageClassName1,
					VolumeMode:                    &volumeMode,
					PersistentVolumeSource: corev1.PersistentVolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/tmp/test-pv",
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pv)).To(Succeed())

			By("creating PVC 1 bound to PV")
			pvc1 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName1,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount:  "true",
						commonModels.LabelCanUpdate: "true",
					},
				},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{
						corev1.ReadWriteOnce,
					},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceStorage: resource.MustParse("10Gi"),
						},
					},
					VolumeName:       pvName1,
					StorageClassName: ptr.To(storageClassName1),
				},
			}
			Expect(k8sClient.Create(ctx, pvc1)).To(Succeed())

			By("creating PVC 2 without cross-references")
			pvc2 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName2,
					Namespace: namespaceName1,
					Labels: map[string]string{
						commonModels.LabelCanMount: "true",
					},
				},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{
						corev1.ReadWriteMany,
					},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceStorage: resource.MustParse("5Gi"),
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pvc2)).To(Succeed())

			By("creating a Pod that mounts PVC 1")
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      podName1,
					Namespace: namespaceName1,
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "test-container",
							Image: "busybox",
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "data",
							VolumeSource: corev1.VolumeSource{
								PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
									ClaimName: pvcName1,
								},
							},
						},
					},
				},
			}
			Expect(k8sClient.Create(ctx, pod)).To(Succeed())

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind(workspaceKindName1)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace that references PVC 1 as home volume")
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
							Home: ptr.To(pvcName1),
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

			By("deleting Pod")
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      podName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pod)).To(Succeed())

			By("deleting PVC 1")
			pvc1 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName1,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pvc1)).To(Succeed())

			By("deleting PVC 2")
			pvc2 := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName2,
					Namespace: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pvc2)).To(Succeed())

			By("deleting PersistentVolume")
			pv := &corev1.PersistentVolume{
				ObjectMeta: metav1.ObjectMeta{
					Name: pvName1,
				},
			}
			Expect(k8sClient.Delete(ctx, pv)).To(Succeed())

			By("deleting StorageClass")
			sc := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: storageClassName1,
				},
			}
			Expect(k8sClient.Delete(ctx, sc)).To(Succeed())

			By("deleting Namespace")
			namespace := &corev1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: namespaceName1,
				},
			}
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		})

		It("should include pod cross-references for PVC 1", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetPVCsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetPVCsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCListEnvelope")
			var response PVCListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("finding PVC 1 in the response")
			var pvc1Response *models.PVCListItem
			for i := range response.Data {
				if response.Data[i].Name == pvcName1 {
					pvc1Response = &response.Data[i]
					break
				}
			}
			Expect(pvc1Response).NotTo(BeNil(), "PVC 1 should be present in the response")

			By("verifying the pod cross-reference")
			Expect(pvc1Response.Pods).To(HaveLen(1))
			Expect(pvc1Response.Pods[0].Name).To(Equal(podName1))
			Expect(pvc1Response.Pods[0].Phase).NotTo(BeEmpty())
		})

		It("should include workspace cross-references for PVC 1", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetPVCsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetPVCsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCListEnvelope")
			var response PVCListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("finding PVC 1 in the response")
			var pvc1Response *models.PVCListItem
			for i := range response.Data {
				if response.Data[i].Name == pvcName1 {
					pvc1Response = &response.Data[i]
					break
				}
			}
			Expect(pvc1Response).NotTo(BeNil(), "PVC 1 should be present in the response")

			By("verifying the workspace cross-reference")
			Expect(pvc1Response.Workspaces).To(HaveLen(1))
			Expect(pvc1Response.Workspaces[0].Name).To(Equal(workspaceName1))
		})

		It("should include bound PV and StorageClass cross-references for PVC 1", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetPVCsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetPVCsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCListEnvelope")
			var response PVCListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("finding PVC 1 in the response")
			var pvc1Response *models.PVCListItem
			for i := range response.Data {
				if response.Data[i].Name == pvcName1 {
					pvc1Response = &response.Data[i]
					break
				}
			}
			Expect(pvc1Response).NotTo(BeNil(), "PVC 1 should be present in the response")

			By("verifying the PV and StorageClass cross-references")
			expectedPVC := &models.PVCListItem{
				Name:      pvcName1,
				CanMount:  true,
				CanUpdate: true,
				Pods: []models.PodInfo{
					{
						Name:  podName1,
						Phase: pvc1Response.Pods[0].Phase, // phase can vary, so we use the actual value from the response
					},
				},
				Workspaces: []models.WorkspaceInfo{
					{
						Name: workspaceName1,
					},
				},
				Audit: pvc1Response.Audit, // audit fields can vary, so we use the actual value from the response
				PVCSpec: models.PVCSpec{
					Requests: models.StorageRequests{
						Storage: "10Gi",
					},
					AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					VolumeMode:       corev1.PersistentVolumeFilesystem,
					StorageClassName: storageClassName1,
				},
				PV: &models.PVInfo{
					Name:                          pvName1,
					PersistentVolumeReclaimPolicy: corev1.PersistentVolumeReclaimDelete,
					VolumeMode:                    corev1.PersistentVolumeFilesystem,
					AccessModes:                   []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					StorageClass: &models.StorageClassInfo{
						Name:        storageClassName1,
						DisplayName: "Test Storage",
						Description: "A test storage class",
					},
				},
			}
			Expect(pvc1Response).To(BeComparableTo(expectedPVC))
		})

		It("should not include cross-references for PVC 2", func() {
			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, namespaceName1, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetPVCsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: namespaceName1},
			}
			rr := httptest.NewRecorder()
			a.GetPVCsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCListEnvelope")
			var response PVCListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("finding PVC 2 in the response")
			var pvc2Response *models.PVCListItem
			for i := range response.Data {
				if response.Data[i].Name == pvcName2 {
					pvc2Response = &response.Data[i]
					break
				}
			}
			Expect(pvc2Response).NotTo(BeNil(), "PVC 2 should be present in the response")

			By("verifying PVC 2 has no cross-references")
			Expect(pvc2Response.Pods).To(BeEmpty())
			Expect(pvc2Response.Workspaces).To(BeEmpty())
			Expect(pvc2Response.PV).To(BeNil())
		})
	})

	// NOTE: these tests assume a specific state of the cluster, so cannot be run in parallel with other tests.
	//       therefore, we run them using the `Serial` Ginkgo decorators.
	Context("with no existing PVCs", Serial, func() {

		It("should return an empty list of PVCs for a non-existent namespace", func() {
			missingNamespace := "non-existent-namespace"

			By("creating the HTTP request")
			path := strings.Replace(PVCsByNamespacePath, ":"+NamespacePathParam, missingNamespace, 1)
			req, err := http.NewRequest(http.MethodGet, path, http.NoBody)
			Expect(err).NotTo(HaveOccurred())

			By("setting the auth headers")
			req.Header.Set(userIdHeader, adminUser)

			By("executing GetPVCsByNamespaceHandler")
			ps := httprouter.Params{
				httprouter.Param{Key: NamespacePathParam, Value: missingNamespace},
			}
			rr := httptest.NewRecorder()
			a.GetPVCsByNamespaceHandler(rr, req, ps)
			rs := rr.Result()
			defer rs.Body.Close()

			By("verifying the HTTP response status code")
			Expect(rs.StatusCode).To(Equal(http.StatusOK), descUnexpectedHTTPStatus, rr.Body.String())

			By("reading the HTTP response body")
			body, err := io.ReadAll(rs.Body)
			Expect(err).NotTo(HaveOccurred())

			By("unmarshalling the response JSON to PVCListEnvelope")
			var response PVCListEnvelope
			err = json.Unmarshal(body, &response)
			Expect(err).NotTo(HaveOccurred())

			By("ensuring that no PVCs were returned")
			Expect(response.Data).To(BeEmpty())
		})
	})
})
