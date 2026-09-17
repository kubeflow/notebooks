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

package helper

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("indexWorkspaceOwner", func() {
	isController := true
	isNotController := false

	newControlledObject := func(apiVersion, kind, name string, controller *bool) *corev1.Service {
		var ownerRefs []metav1.OwnerReference
		if apiVersion != "" || kind != "" || name != "" {
			ownerRefs = []metav1.OwnerReference{
				{
					APIVersion: apiVersion,
					Kind:       kind,
					Name:       name,
					UID:        "owner-uid",
					Controller: controller,
				},
			}
		}
		return &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "test-service",
				Namespace:       "default",
				OwnerReferences: ownerRefs,
			},
		}
	}

	It("should match when owner has exact APIVersion and Kind Workspace", func() {
		svc := newControlledObject("kubeflow.org/v1beta1", "Workspace", "my-workspace", &isController)
		Expect(indexWorkspaceOwner(svc)).To(Equal([]string{"my-workspace"}))
	})

	It("should match across CRD API version skew within the kubeflow.org group", func() {
		svcAlpha := newControlledObject("kubeflow.org/v1alpha1", "Workspace", "my-workspace", &isController)
		Expect(indexWorkspaceOwner(svcAlpha)).To(Equal([]string{"my-workspace"}))

		svcV2 := newControlledObject("kubeflow.org/v2", "Workspace", "my-workspace", &isController)
		Expect(indexWorkspaceOwner(svcV2)).To(Equal([]string{"my-workspace"}))
	})

	It("should return nil when owner has different API group", func() {
		svcApps := newControlledObject("apps/v1", "Workspace", "my-workspace", &isController)
		Expect(indexWorkspaceOwner(svcApps)).To(BeNil())

		svcOther := newControlledObject("example.com/v1", "Workspace", "my-workspace", &isController)
		Expect(indexWorkspaceOwner(svcOther)).To(BeNil())
	})

	It("should return nil when owner has different Kind", func() {
		svcKind := newControlledObject("kubeflow.org/v1beta1", "WorkspaceKind", "my-kind", &isController)
		Expect(indexWorkspaceOwner(svcKind)).To(BeNil())

		svcSts := newControlledObject("apps/v1", "StatefulSet", "my-sts", &isController)
		Expect(indexWorkspaceOwner(svcSts)).To(BeNil())
	})

	It("should return nil when object has no owner or controller", func() {
		svcNoOwner := newControlledObject("", "", "", nil)
		Expect(indexWorkspaceOwner(svcNoOwner)).To(BeNil())

		svcNotCtrl := newControlledObject("kubeflow.org/v1beta1", "Workspace", "my-workspace", &isNotController)
		Expect(indexWorkspaceOwner(svcNotCtrl)).To(BeNil())

		svcNilCtrl := newControlledObject("kubeflow.org/v1beta1", "Workspace", "my-workspace", nil)
		Expect(indexWorkspaceOwner(svcNilCtrl)).To(BeNil())
	})

	It("should return nil when owner APIVersion is malformed", func() {
		svcInvalid := newControlledObject("///invalid", "Workspace", "my-workspace", &isController)
		Expect(indexWorkspaceOwner(svcInvalid)).To(BeNil())
	})
})
