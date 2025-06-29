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

package namespaces

import (
	"context"
	"errors"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestNamespaceRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "NamespaceRepository Suite")
}

var _ = Describe("Namespaces", Ordered, func() {
	var (
		scheme        *runtime.Scheme
		fakeClient    client.Client
		namespaceRepo *NamespaceRepository
		ctx           context.Context
	)
	BeforeAll(func() {
		ctx = context.Background()
		scheme = runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
	})
	Context("with no existing Namespaces", func() {
		BeforeEach(func() {
			fakeClient = fake.NewClientBuilder().WithScheme(scheme).Build()
			namespaceRepo = NewNamespaceRepository(fakeClient)

		})
		It("should return an empty list of Namespaces", func() {
			namespaces, err := namespaceRepo.GetNamespaces(ctx)
			Expect(err).NotTo(HaveOccurred())
			Expect(namespaces).To(BeEmpty())
		})
	})
	Context("with existing Namespaces", func() {
		BeforeEach(func() {
			ns1 := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test-ns-1"}}
			ns2 := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test-ns-2"}}

			fakeClient = fake.NewClientBuilder().WithScheme(scheme).WithObjects(ns1, ns2).Build()
			namespaceRepo = NewNamespaceRepository(fakeClient)

		})
		It("should return all namespaces", func() {
			namespaces, err := namespaceRepo.GetNamespaces(ctx)
			Expect(err).NotTo(HaveOccurred())
			Expect(namespaces).To(HaveLen(2))
			Expect(namespaces[0].Name).To(Equal("test-ns-1"))
			Expect(namespaces[1].Name).To(Equal("test-ns-2"))
		})
	})
	Context("when client.List returns an error", func() {
		BeforeEach(func() {
			fakeClient := fake.NewClientBuilder().WithScheme(scheme).Build()
			errorClient := &erroringClient{Client: fakeClient}
			namespaceRepo = NewNamespaceRepository(errorClient)
		})

		It("should return an error", func() {
			namespaces, err := namespaceRepo.GetNamespaces(ctx)
			Expect(err).To(HaveOccurred())
			var mockErr *MockError
			Expect(errors.As(err, &mockErr)).To(BeTrue())
			Expect(namespaces).To(BeNil())
		})
	})
})

// Define a wrapper client that forces an error on List() method of client
type erroringClient struct {
	client.Client
}

type MockError struct {
	message string
}

func (e *MockError) Error() string {
	return e.message
}

func (e *erroringClient) List(ctx context.Context, list client.ObjectList, opts ...client.ListOption) error {
	return &MockError{message: "mocked list error"}
}
