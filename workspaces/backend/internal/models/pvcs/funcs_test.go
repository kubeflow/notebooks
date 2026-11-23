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

package pvcs

import (
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

func TestPVCs(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "PVCs Models Suite")
}

var _ = Describe("PVC Model Conversions", func() {

	newBasePVC := func() *corev1.PersistentVolumeClaim {
		return &corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "data-pvc",
				Namespace: "team-a",
				Labels: map[string]string{
					common.LabelCanMount:  "true",
					common.LabelCanUpdate: "false",
				},
			},
			Spec: corev1.PersistentVolumeClaimSpec{
				AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
				StorageClassName: ptr.To("standard"),
				Resources: corev1.VolumeResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceStorage: resource.MustParse("10Gi"),
					},
				},
			},
		}
	}

	Describe("NewPVCCreateModelFromPVC", func() {
		It("should convert a PVC to PVCCreate model", func() {
			pvc := newBasePVC()

			model := NewPVCCreateModelFromPVC(pvc)
			Expect(model.Name).To(Equal("data-pvc"))
			Expect(model.AccessModes).To(Equal([]corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce}))
			Expect(model.StorageClassName).To(Equal("standard"))
			Expect(model.Requests.Storage).To(Equal("10Gi"))
		})

		It("should default StorageClassName to empty string when nil", func() {
			pvc := newBasePVC()
			pvc.Spec.StorageClassName = nil

			model := NewPVCCreateModelFromPVC(pvc)
			Expect(model.StorageClassName).To(BeEmpty())
		})
	})

	Describe("NewPVCListItemFromPVC", func() {
		It("should build an unbound PVCListItem with nil PV and empty pod/workspace lists", func() {
			pvc := newBasePVC()

			item := NewPVCListItemFromPVC(pvc, nil, nil, map[string][]PodInfo{}, map[string][]WorkspaceInfo{})
			Expect(item.Name).To(Equal("data-pvc"))
			Expect(item.CanMount).To(BeTrue())
			Expect(item.CanUpdate).To(BeFalse())
			Expect(item.PV).To(BeNil())
			Expect(item.Pods).To(BeEmpty())
			Expect(item.Workspaces).To(BeEmpty())
			Expect(item.PVCSpec.Requests.Storage).To(Equal("10Gi"))
			Expect(item.PVCSpec.VolumeMode).To(Equal(corev1.PersistentVolumeFilesystem))
		})

		It("should populate PV, StorageClass, Pods, and Workspaces when bound", func() {
			pvc := newBasePVC()
			pv := &corev1.PersistentVolume{
				ObjectMeta: metav1.ObjectMeta{
					Name: "pv-1",
					UID:  types.UID("pv-uid-1"),
				},
				Spec: corev1.PersistentVolumeSpec{
					PersistentVolumeReclaimPolicy: corev1.PersistentVolumeReclaimDelete,
					AccessModes:                   []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					VolumeMode:                    ptr.To(corev1.PersistentVolumeBlock),
				},
			}
			sc := &storagev1.StorageClass{
				ObjectMeta: metav1.ObjectMeta{
					Name: "standard",
					UID:  types.UID("sc-uid-1"),
				},
			}
			pods := map[string][]PodInfo{
				"data-pvc": {{Name: "pod-1", Phase: corev1.PodRunning}},
			}
			workspaces := map[string][]WorkspaceInfo{
				"data-pvc": {{Name: "ws-1", State: kubefloworgv1beta1.WorkspaceStateRunning}},
			}

			item := NewPVCListItemFromPVC(pvc, pv, sc, pods, workspaces)
			Expect(item.PV).NotTo(BeNil())
			Expect(item.PV.Name).To(Equal("pv-1"))
			Expect(item.PV.VolumeMode).To(Equal(corev1.PersistentVolumeBlock))
			Expect(item.PV.PersistentVolumeReclaimPolicy).To(Equal(corev1.PersistentVolumeReclaimDelete))
			Expect(item.PV.StorageClass).NotTo(BeNil())
			Expect(item.PV.StorageClass.Name).To(Equal("standard"))
			Expect(item.Pods).To(HaveLen(1))
			Expect(item.Workspaces).To(HaveLen(1))
		})
	})
})
