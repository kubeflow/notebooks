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

package workspacekinds

import (
	"context"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestWorkspaceKinds(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "WorkspaceKinds Suite")
}

func newTestWorkspaceKindRepository(initObjs ...client.Object) *WorkspaceKindRepository {
	s := runtime.NewScheme()
	_ = kubefloworgv1beta1.AddToScheme(s)

	cl := fake.NewClientBuilder().WithScheme(s).WithObjects(initObjs...).Build()
	return NewWorkspaceKindRepository(cl)
}

var _ = Describe("WorkspaceKindRepository", func() {
	var (
		ctx context.Context
	)

	BeforeEach(func() {
		ctx = context.Background()
	})

	Describe("GetWorkspaceKind", func() {
		const kindName = "test-kind"

		It("returns the WorkspaceKind if it exists", func() {
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: kindName},
				Spec: kubefloworgv1beta1.WorkspaceKindSpec{
					Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
						DisplayName: "Test Workspace Kind",
					},
				},
			}

			repo := newTestWorkspaceKindRepository(workspaceKind)
			got, err := repo.GetWorkspaceKind(ctx, kindName)

			Expect(err).ToNot(HaveOccurred())
			Expect(got.Name).To(Equal(kindName))
			Expect(got.DisplayName).To(Equal("Test Workspace Kind"))
		})

		It("returns an error if the WorkspaceKind is not found", func() {
			repo := newTestWorkspaceKindRepository()
			_, err := repo.GetWorkspaceKind(ctx, "non-existent")

			Expect(err).To(MatchError(ErrWorkspaceKindNotFound))
		})
	})

	Describe("GetWorkspaceKinds", func() {
		It("returns all WorkspaceKinds", func() {
			workspaceKind1 := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: "kind-1"},
				Spec: kubefloworgv1beta1.WorkspaceKindSpec{
					Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
						DisplayName: "Kind One",
					},
				},
			}
			workspaceKind2 := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: "kind-2"},
				Spec: kubefloworgv1beta1.WorkspaceKindSpec{
					Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
						DisplayName: "Kind Two",
					},
				},
			}

			repo := newTestWorkspaceKindRepository(workspaceKind1, workspaceKind2)
			kinds, err := repo.GetWorkspaceKinds(ctx)

			Expect(err).ToNot(HaveOccurred())
			Expect(kinds).To(HaveLen(2))

			expected := []models.WorkspaceKind{
				models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind1),
				models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind2),
			}
			Expect(kinds).To(ConsistOf(expected))
		})

		It("returns an empty slice when no WorkspaceKinds exist", func() {
			repo := newTestWorkspaceKindRepository()
			kinds, err := repo.GetWorkspaceKinds(ctx)

			Expect(err).ToNot(HaveOccurred())
			Expect(kinds).To(BeEmpty())
		})
	})
})
