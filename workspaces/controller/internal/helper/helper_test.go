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
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("CopyServiceAccountFields", func() {

	// newServiceAccount returns a ServiceAccount with the provided labels and annotations.
	newServiceAccount := func(labels, annotations map[string]string) *corev1.ServiceAccount {
		return &corev1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "ws-my-workspace",
				Namespace:   "my-namespace",
				Labels:      labels,
				Annotations: annotations,
			},
		}
	}

	It("should preserve labels and annotations which are only on the target", func() {
		// cluster administrators and other controllers attach their own metadata to a
		// ServiceAccount (for example the cloud IAM annotations used by IRSA or GKE
		// Workload Identity), so the desired metadata is merged, not copied over
		desired := newServiceAccount(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"},
			nil,
		)
		target := newServiceAccount(
			map[string]string{
				"notebooks.kubeflow.org/workspace-name": "my-workspace",
				"my-label":                              "my-value",
			},
			map[string]string{"eks.amazonaws.com/role-arn": "arn:aws:iam::000000000000:role/my-role"},
		)

		Expect(CopyServiceAccountFields(desired, target)).To(BeFalse())
		Expect(target.Labels).To(HaveKeyWithValue("my-label", "my-value"))
		Expect(target.Annotations).To(HaveKeyWithValue("eks.amazonaws.com/role-arn", "arn:aws:iam::000000000000:role/my-role"))
	})

	It("should add and overwrite the desired labels and annotations", func() {
		desired := newServiceAccount(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"},
			map[string]string{"my-annotation": "new-value"},
		)
		target := newServiceAccount(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "other-workspace"},
			map[string]string{"my-annotation": "old-value"},
		)

		Expect(CopyServiceAccountFields(desired, target)).To(BeTrue())
		Expect(target.Labels).To(HaveKeyWithValue("notebooks.kubeflow.org/workspace-name", "my-workspace"))
		Expect(target.Annotations).To(HaveKeyWithValue("my-annotation", "new-value"))
	})

	It("should initialize nil maps on the target", func() {
		desired := newServiceAccount(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"},
			map[string]string{"my-annotation": "my-value"},
		)
		target := newServiceAccount(nil, nil)

		Expect(CopyServiceAccountFields(desired, target)).To(BeTrue())
		Expect(target.Labels).To(HaveKeyWithValue("notebooks.kubeflow.org/workspace-name", "my-workspace"))
		Expect(target.Annotations).To(HaveKeyWithValue("my-annotation", "my-value"))
	})

	It("should not require an update when the desired metadata is empty", func() {
		desired := newServiceAccount(nil, nil)
		target := newServiceAccount(map[string]string{"my-label": "my-value"}, nil)

		Expect(CopyServiceAccountFields(desired, target)).To(BeFalse())
		Expect(target.Labels).To(HaveKeyWithValue("my-label", "my-value"))
	})
})

var _ = Describe("CopyRoleBindingFields", func() {

	// newSubject returns a ServiceAccount subject with the provided name.
	newSubject := func(name string) rbacv1.Subject {
		return rbacv1.Subject{
			Kind:      rbacv1.ServiceAccountKind,
			Name:      name,
			Namespace: "my-namespace",
		}
	}

	// newRoleBinding returns a RoleBinding with the provided labels, ClusterRole, and subjects.
	newRoleBinding := func(labels map[string]string, clusterRoleName string, subjects ...rbacv1.Subject) *rbacv1.RoleBinding {
		return &rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-abcdef",
				Namespace: "my-namespace",
				Labels:    labels,
			},
			RoleRef: rbacv1.RoleRef{
				APIGroup: rbacv1.GroupName,
				Kind:     "ClusterRole",
				Name:     clusterRoleName,
			},
			Subjects: subjects,
		}
	}

	It("should not require an update when the desired and target match", func() {
		labels := map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"}
		desired := newRoleBinding(labels, "kubeflow-edit", newSubject("ws-my-workspace"))
		target := newRoleBinding(labels, "kubeflow-edit", newSubject("ws-my-workspace"))

		Expect(CopyRoleBindingFields(desired, target)).To(BeFalse())
	})

	It("should replace labels which are only on the target", func() {
		// unlike a ServiceAccount, the controller fully owns a RoleBinding it created,
		// so its metadata is replaced rather than merged
		desired := newRoleBinding(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"},
			"kubeflow-edit",
			newSubject("ws-my-workspace"),
		)
		target := newRoleBinding(
			map[string]string{
				"notebooks.kubeflow.org/workspace-name": "my-workspace",
				"my-label":                              "my-value",
			},
			"kubeflow-edit",
			newSubject("ws-my-workspace"),
		)

		Expect(CopyRoleBindingFields(desired, target)).To(BeTrue())
		Expect(target.Labels).NotTo(HaveKey("my-label"))
		Expect(target.Labels).To(HaveKeyWithValue("notebooks.kubeflow.org/workspace-name", "my-workspace"))
	})

	It("should copy the desired subjects", func() {
		labels := map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"}
		desired := newRoleBinding(labels, "kubeflow-edit", newSubject("ws-my-workspace"))
		target := newRoleBinding(labels, "kubeflow-edit", newSubject("default-editor"))

		Expect(CopyRoleBindingFields(desired, target)).To(BeTrue())
		Expect(target.Subjects).To(Equal([]rbacv1.Subject{newSubject("ws-my-workspace")}))
	})

	It("should not copy the immutable roleRef", func() {
		// `roleRef` is immutable, the caller is responsible for recreating the RoleBinding
		// when it has drifted, so a differing roleRef must not be reported as an update
		labels := map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"}
		desired := newRoleBinding(labels, "kubeflow-edit", newSubject("ws-my-workspace"))
		target := newRoleBinding(labels, "kubeflow-view", newSubject("ws-my-workspace"))

		Expect(CopyRoleBindingFields(desired, target)).To(BeFalse())
		Expect(target.RoleRef.Name).To(Equal("kubeflow-view"))
	})
})
