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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authentication/user"
)

var _ = Describe("ResourcePolicy", func() {

	DescribeTable("NewResourcePolicy maps each supported resource to its GVR",
		func(resource ResourcePolicyResource, expectedGVR schema.GroupVersionResource) {
			meta := ResourcePolicyResourceMeta{Namespace: "ns-1", Name: "res-1"}
			policy := NewResourcePolicy(VerbGet, resource, meta)

			Expect(policy.Verb).To(Equal(VerbGet))
			Expect(policy.GVR).To(Equal(expectedGVR))
			Expect(policy.ResourceMeta).To(Equal(meta))
		},
		Entry("namespaces", Namespaces, corev1.SchemeGroupVersion.WithResource("namespaces")),
		Entry("persistentvolumeclaims", PersistentVolumeClaims, corev1.SchemeGroupVersion.WithResource("persistentvolumeclaims")),
		Entry("secrets", Secrets, corev1.SchemeGroupVersion.WithResource("secrets")),
		Entry("storageclasses", StorageClasses, storagev1.SchemeGroupVersion.WithResource("storageclasses")),
		Entry("workspacekinds", WorkspaceKinds, kubefloworgv1beta1.GroupVersion.WithResource("workspacekinds")),
		Entry("workspaces", Workspaces, kubefloworgv1beta1.GroupVersion.WithResource("workspaces")),
	)

	It("should panic on unsupported ResourcePolicyResource", func() {
		Expect(func() {
			NewResourcePolicy(VerbGet, ResourcePolicyResource("unsupported"), ResourcePolicyResourceMeta{})
		}).To(PanicWith(ContainSubstring("unsupported ResourcePolicyResource")))
	})

	It("should build authorizer.Attributes for a namespaced resource", func() {
		u := &user.DefaultInfo{Name: "alice", Groups: []string{"devs"}}
		policy := NewResourcePolicy(VerbUpdate, Workspaces, ResourcePolicyResourceMeta{
			Namespace: "team-a",
			Name:      "my-ws",
		})

		attrs := policy.AttributesFor(u)
		Expect(attrs.GetUser()).To(Equal(u))
		Expect(attrs.GetVerb()).To(Equal("update"))
		Expect(attrs.GetNamespace()).To(Equal("team-a"))
		Expect(attrs.GetAPIGroup()).To(Equal(kubefloworgv1beta1.GroupVersion.Group))
		Expect(attrs.GetAPIVersion()).To(Equal(kubefloworgv1beta1.GroupVersion.Version))
		Expect(attrs.GetResource()).To(Equal("workspaces"))
		Expect(attrs.GetSubresource()).To(BeEmpty())
		Expect(attrs.GetName()).To(Equal("my-ws"))
		Expect(attrs.IsResourceRequest()).To(BeTrue())
	})

	It("should build authorizer.Attributes for a cluster-scoped resource", func() {
		u := &user.DefaultInfo{Name: "admin"}
		policy := NewResourcePolicy(VerbList, WorkspaceKinds, ResourcePolicyResourceMeta{})

		attrs := policy.AttributesFor(u)
		Expect(attrs.GetUser()).To(Equal(u))
		Expect(attrs.GetVerb()).To(Equal("list"))
		Expect(attrs.GetNamespace()).To(BeEmpty())
		Expect(attrs.GetName()).To(BeEmpty())
		Expect(attrs.GetResource()).To(Equal("workspacekinds"))
		Expect(attrs.IsResourceRequest()).To(BeTrue())
	})
})
