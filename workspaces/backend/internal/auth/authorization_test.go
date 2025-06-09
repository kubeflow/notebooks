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

package auth

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authentication/user"
)

type mockObject struct {
	metav1.ObjectMeta
	metav1.TypeMeta
}

func (m *mockObject) GetObjectKind() schema.ObjectKind { return &m.TypeMeta }

func (m *mockObject) DeepCopyObject() runtime.Object {
	return &mockObject{
		ObjectMeta: *m.ObjectMeta.DeepCopy(),
		TypeMeta:   m.TypeMeta,
	}
}

var _ runtime.Object = &mockObject{}
var _ = Describe("NewResourcePolicy", func() {
	It("creates policy for a namespaced resource", func() {
		mock := &mockObject{}
		mock.SetName("my-deployment")
		mock.SetNamespace("my-namespace")
		mock.SetGroupVersionKind(schema.GroupVersionKind{
			Group:   "apps",
			Version: "v1",
			Kind:    "Deployment",
		})

		policy := NewResourcePolicy(ResourceVerbGet, mock)

		Expect(policy).NotTo(BeNil())
		Expect(policy.Verb).To(Equal(ResourceVerbGet))
		Expect(policy.Group).To(Equal("apps"))
		Expect(policy.Version).To(Equal("v1"))
		Expect(policy.Kind).To(Equal("Deployment"))
		Expect(policy.Namespace).To(Equal("my-namespace"))
		Expect(policy.Name).To(Equal("my-deployment"))
	})

	It("creates policy for a cluster-scoped resource", func() {
		mock := &mockObject{}
		mock.SetName("my-cluster-role")
		mock.SetGroupVersionKind(schema.GroupVersionKind{
			Group:   "rbac.authorization.k8s.io",
			Version: "v1",
			Kind:    "ClusterRole",
		})

		policy := NewResourcePolicy(ResourceVerbDelete, mock)

		Expect(policy).NotTo(BeNil())
		Expect(policy.Verb).To(Equal(ResourceVerbDelete))
		Expect(policy.Group).To(Equal("rbac.authorization.k8s.io"))
		Expect(policy.Kind).To(Equal("ClusterRole"))
		Expect(policy.Name).To(Equal("my-cluster-role"))
		Expect(policy.Namespace).To(BeEmpty())
	})
})

var _ = Describe("AttributesFor", func() {
	userInfo := &user.DefaultInfo{
		Name:   "test-user",
		Groups: []string{"group-a", "system:authenticated"},
	}

	It("creates attributes for a specific resource", func() {
		policy := &ResourcePolicy{
			Verb:      ResourceVerbUpdate,
			Group:     "kubeflow.org",
			Version:   "v1beta1",
			Kind:      "Workspace",
			Namespace: "user-namespace",
			Name:      "my-workspace",
		}

		attrs := policy.AttributesFor(userInfo)
		Expect(attrs).NotTo(BeNil())
		Expect(attrs.GetUser()).To(Equal(userInfo))
		Expect(attrs.GetVerb()).To(Equal("update"))
		Expect(attrs.GetNamespace()).To(Equal("user-namespace"))
		Expect(attrs.GetAPIGroup()).To(Equal("kubeflow.org"))
		Expect(attrs.GetAPIVersion()).To(Equal("v1beta1"))
		Expect(attrs.GetResource()).To(Equal("Workspace"))
		Expect(attrs.GetName()).To(Equal("my-workspace"))
		Expect(attrs.IsResourceRequest()).To(BeTrue())
	})

	It("creates attributes for a collection of resources", func() {
		policy := &ResourcePolicy{
			Verb:      ResourceVerbList,
			Group:     "kubeflow.org",
			Version:   "v1beta1",
			Kind:      "Workspace",
			Namespace: "user-namespace",
			Name:      "",
		}

		attrs := policy.AttributesFor(userInfo)
		Expect(attrs).NotTo(BeNil())
		Expect(attrs.GetUser()).To(Equal(userInfo))
		Expect(attrs.GetVerb()).To(Equal("list"))
		Expect(attrs.GetNamespace()).To(Equal("user-namespace"))
		Expect(attrs.GetName()).To(BeEmpty())
		Expect(attrs.IsResourceRequest()).To(BeTrue())
	})
})
