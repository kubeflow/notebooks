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

	istiov1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
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

var _ = Describe("CopyStatefulSetFields", func() {

	// newStatefulSet returns a StatefulSet with the provided labels and annotations.
	// spec.replicas is set so CopyStatefulSetFields can dereference it, and the selector
	// and template are left equal so only metadata differences are exercised.
	newStatefulSet := func(labels, annotations map[string]string) *appsv1.StatefulSet {
		replicas := int32(1)
		return &appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "ws-my-workspace-abcdef",
				Namespace:   "my-namespace",
				Labels:      labels,
				Annotations: annotations,
			},
			Spec: appsv1.StatefulSetSpec{
				Replicas: &replicas,
			},
		}
	}

	It("should not require an update when the desired and target metadata match", func() {
		labels := map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"}
		desired := newStatefulSet(labels, nil)
		target := newStatefulSet(labels, nil)

		Expect(CopyStatefulSetFields(desired, target)).To(BeFalse())
	})

	It("should require an update when the desired adds a new label", func() {
		// a label present only on the desired StatefulSet must be detected, otherwise
		// labels added to a WorkspaceKind never reach already-running StatefulSets
		desired := newStatefulSet(
			map[string]string{
				"notebooks.kubeflow.org/workspace-name": "my-workspace",
				"my-label":                              "my-value",
			},
			nil,
		)
		target := newStatefulSet(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"},
			nil,
		)

		Expect(CopyStatefulSetFields(desired, target)).To(BeTrue())
		Expect(target.Labels).To(HaveKeyWithValue("my-label", "my-value"))
	})

	It("should require an update when the desired adds a new annotation", func() {
		desired := newStatefulSet(nil, map[string]string{"my-annotation": "my-value"})
		target := newStatefulSet(nil, nil)

		Expect(CopyStatefulSetFields(desired, target)).To(BeTrue())
		Expect(target.Annotations).To(HaveKeyWithValue("my-annotation", "my-value"))
	})

	It("should replace labels which are only on the target", func() {
		// the controller fully owns the StatefulSet it created, so its metadata is
		// replaced rather than merged
		desired := newStatefulSet(
			map[string]string{"notebooks.kubeflow.org/workspace-name": "my-workspace"},
			nil,
		)
		target := newStatefulSet(
			map[string]string{
				"notebooks.kubeflow.org/workspace-name": "my-workspace",
				"stale-label":                           "stale-value",
			},
			nil,
		)

		Expect(CopyStatefulSetFields(desired, target)).To(BeTrue())
		Expect(target.Labels).NotTo(HaveKey("stale-label"))
	})
})

var _ = Describe("ReplaceWorkspaceAsController", func() {
	var (
		scheme *runtime.Scheme
	)

	BeforeEach(func() {
		scheme = runtime.NewScheme()
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(appsv1.AddToScheme(scheme)).To(Succeed())
		Expect(istiov1.AddToScheme(scheme)).To(Succeed())
	})

	newWorkspace := func(name, uid string) *kubefloworgv1beta1.Workspace {
		return &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:      name,
				Namespace: "default",
				UID:       types.UID(uid),
			},
		}
	}

	It("should correctly replace controller reference from one Workspace to another (re-adoption) on StatefulSet", func() {
		wsOld := newWorkspace("ws-old", "old-uid")
		wsNew := newWorkspace("ws-new", "new-uid")

		sts := &appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-sts",
				Namespace: "default",
			},
		}
		Expect(controllerutil.SetControllerReference(wsOld, sts, scheme)).To(Succeed())
		Expect(metav1.IsControlledBy(sts, wsOld)).To(BeTrue())

		// Attach an extra non-controller owner reference to ensure it is preserved
		nonControllerRef := metav1.OwnerReference{
			APIVersion: "kubeflow.org/v1beta1",
			Kind:       "WorkspaceKind",
			Name:       "jupyterlab",
			UID:        "kind-uid",
		}
		sts.SetOwnerReferences(append(sts.GetOwnerReferences(), nonControllerRef))

		replaced, err := ReplaceWorkspaceAsController(sts, wsNew, scheme)
		Expect(err).NotTo(HaveOccurred())
		Expect(replaced).To(BeTrue())

		Expect(metav1.IsControlledBy(sts, wsNew)).To(BeTrue())
		Expect(metav1.IsControlledBy(sts, wsOld)).To(BeFalse())

		ownerRefs := sts.GetOwnerReferences()
		Expect(ownerRefs).To(HaveLen(2))

		// Check new controller reference
		ctrlRef := metav1.GetControllerOf(sts)
		Expect(ctrlRef).NotTo(BeNil())
		Expect(ctrlRef.UID).To(Equal(types.UID("new-uid")))
		Expect(ctrlRef.Name).To(Equal("ws-new"))
		Expect(ctrlRef.Kind).To(Equal("Workspace"))

		// Check non-controller reference was preserved
		var foundNonCtrl bool
		for _, ref := range ownerRefs {
			if ref.UID == "kind-uid" {
				foundNonCtrl = true
				Expect(ref.Controller).To(BeNil())
			}
		}
		Expect(foundNonCtrl).To(BeTrue())
	})

	It("should correctly replace controller reference when StatefulSet is owned by a Workspace with an older API version", func() {
		wsNew := newWorkspace("my-workspace", "new-uid")

		isController := true
		blockOwnerDeletion := true
		sts := &appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-sts",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{
					{
						APIVersion:         "kubeflow.org/v1alpha1",
						Kind:               "Workspace",
						Name:               "my-workspace",
						UID:                types.UID("old-uid"),
						Controller:         &isController,
						BlockOwnerDeletion: &blockOwnerDeletion,
					},
				},
			},
		}

		replaced, err := ReplaceWorkspaceAsController(sts, wsNew, scheme)
		Expect(err).NotTo(HaveOccurred())
		Expect(replaced).To(BeTrue())

		Expect(metav1.IsControlledBy(sts, wsNew)).To(BeTrue())
		ctrlRef := metav1.GetControllerOf(sts)
		Expect(ctrlRef).NotTo(BeNil())
		Expect(ctrlRef.APIVersion).To(Equal(kubefloworgv1beta1.GroupVersion.String()))
		Expect(ctrlRef.UID).To(Equal(types.UID("new-uid")))
		Expect(ctrlRef.Kind).To(Equal("Workspace"))
		Expect(ctrlRef.Name).To(Equal("my-workspace"))
	})

	It("should correctly replace controller reference from one Workspace to another on Service", func() {
		wsOld := newWorkspace("my-workspace", "old-uid")
		wsNew := newWorkspace("my-workspace", "new-uid")

		svc := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-svc",
				Namespace: "default",
			},
		}
		Expect(controllerutil.SetControllerReference(wsOld, svc, scheme)).To(Succeed())
		Expect(metav1.IsControlledBy(svc, wsOld)).To(BeTrue())

		replaced, err := ReplaceWorkspaceAsController(svc, wsNew, scheme)
		Expect(err).NotTo(HaveOccurred())
		Expect(replaced).To(BeTrue())

		Expect(metav1.IsControlledBy(svc, wsNew)).To(BeTrue())
		Expect(metav1.IsControlledBy(svc, wsOld)).To(BeFalse())
		ctrlRef := metav1.GetControllerOf(svc)
		Expect(ctrlRef).NotTo(BeNil())
		Expect(ctrlRef.UID).To(Equal(types.UID("new-uid")))
	})

	It("should correctly replace controller reference from one Workspace to another on VirtualService", func() {
		wsOld := newWorkspace("my-workspace", "old-uid")
		wsNew := newWorkspace("my-workspace", "new-uid")

		vs := &istiov1.VirtualService{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-vs",
				Namespace: "default",
			},
		}
		Expect(controllerutil.SetControllerReference(wsOld, vs, scheme)).To(Succeed())
		Expect(metav1.IsControlledBy(vs, wsOld)).To(BeTrue())

		replaced, err := ReplaceWorkspaceAsController(vs, wsNew, scheme)
		Expect(err).NotTo(HaveOccurred())
		Expect(replaced).To(BeTrue())

		Expect(metav1.IsControlledBy(vs, wsNew)).To(BeTrue())
		Expect(metav1.IsControlledBy(vs, wsOld)).To(BeFalse())
		ctrlRef := metav1.GetControllerOf(vs)
		Expect(ctrlRef).NotTo(BeNil())
		Expect(ctrlRef.UID).To(Equal(types.UID("new-uid")))
	})

	It("should be a no-op when the resource is already controlled by the target Workspace", func() {
		ws := newWorkspace("my-workspace", "ws-uid")
		svc := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-svc",
				Namespace: "default",
			},
		}
		Expect(controllerutil.SetControllerReference(ws, svc, scheme)).To(Succeed())
		originalOwnerRefs := svc.GetOwnerReferences()

		replaced, err := ReplaceWorkspaceAsController(svc, ws, scheme)
		Expect(err).NotTo(HaveOccurred())
		Expect(replaced).To(BeFalse())
		Expect(svc.GetOwnerReferences()).To(Equal(originalOwnerRefs))
	})

	It("should return an error when the resource is controlled by a non-Workspace resource", func() {
		ws := newWorkspace("my-workspace", "ws-uid")
		isController := true
		svc := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-svc",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{
					{
						APIVersion: "apps/v1",
						Kind:       "StatefulSet",
						Name:       "parent-sts",
						UID:        "sts-uid",
						Controller: &isController,
					},
				},
			},
		}

		replaced, err := ReplaceWorkspaceAsController(svc, ws, scheme)
		Expect(err).To(HaveOccurred())
		Expect(replaced).To(BeFalse())
		Expect(err.Error()).To(ContainSubstring("which is not a Workspace"))
		Expect(metav1.IsControlledBy(svc, ws)).To(BeFalse())
		ctrlRef := metav1.GetControllerOf(svc)
		Expect(ctrlRef).NotTo(BeNil())
		Expect(ctrlRef.Kind).To(Equal("StatefulSet"))
	})

	It("should successfully set controller reference when the resource has no controller reference", func() {
		ws := newWorkspace("my-workspace", "ws-uid")
		svc := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ws-my-workspace-svc",
				Namespace: "default",
			},
		}

		replaced, err := ReplaceWorkspaceAsController(svc, ws, scheme)
		Expect(err).NotTo(HaveOccurred())
		Expect(replaced).To(BeTrue())
		Expect(metav1.IsControlledBy(svc, ws)).To(BeTrue())
	})
})
