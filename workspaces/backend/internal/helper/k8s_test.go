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
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var _ = Describe("Helper functions", func() {
	Describe("BuildScheme", func() {
		It("should return a scheme that recognizes Pod and Workspace types", func() {
			scheme, err := BuildScheme()
			Expect(err).NotTo(HaveOccurred())
			Expect(scheme).NotTo(BeNil())

			podGVK := corev1.SchemeGroupVersion.WithKind("Pod")
			Expect(scheme.Recognizes(podGVK)).To(BeTrue())

			workspaceGVK := schema.GroupVersionKind{
				Group:   "kubeflow.org",
				Version: "v1beta1",
				Kind:    "Workspace",
			}
			Expect(scheme.Recognizes(workspaceGVK)).To(BeTrue())
		})
	})
})
