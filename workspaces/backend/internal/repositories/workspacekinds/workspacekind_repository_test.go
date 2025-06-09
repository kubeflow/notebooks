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

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
)

// newTestWorkspaceKindRepository creates a WorkspaceKindRepository with a fake client
// initialized with the given Kubernetes objects.
func newTestWorkspaceKindRepository(initObjs ...client.Object) *WorkspaceKindRepository {
	s := runtime.NewScheme()
	kubefloworgv1beta1.AddToScheme(s)

	cl := fake.NewClientBuilder().WithScheme(s).WithObjects(initObjs...).Build()

	return NewWorkspaceKindRepository(cl)
}

func TestGetWorkspaceKind(t *testing.T) {
	ctx := context.Background()
	workspaceKindName := "test-kind"

	// Create a sample WorkspaceKind resource
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: workspaceKindName,
		},
		Spec: kubefloworgv1beta1.WorkspaceKindSpec{
			Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
				DisplayName: "Test Workspace Kind",
			},
		},
	}

	t.Run("found", func(t *testing.T) {
		repo := newTestWorkspaceKindRepository(workspaceKind)
		got, err := repo.GetWorkspaceKind(ctx, workspaceKindName)

		assert.NoError(t, err)
		assert.Equal(t, workspaceKindName, got.Name)
		assert.Equal(t, workspaceKind.Spec.Spawner.DisplayName, got.DisplayName)
	})

	t.Run("not found", func(t *testing.T) {
		repo := newTestWorkspaceKindRepository() // No objects in the fake client
		_, err := repo.GetWorkspaceKind(ctx, "non-existent-kind")

		assert.ErrorIs(t, err, ErrWorkspaceKindNotFound)
	})
}

func TestGetWorkspaceKinds(t *testing.T) {
	ctx := context.Background()

	// Create some sample WorkspaceKind resources
	workspaceKind1 := &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: "kind-1",
		},
		Spec: kubefloworgv1beta1.WorkspaceKindSpec{
			Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
				DisplayName: "Kind One",
			},
		},
	}
	workspaceKind2 := &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: "kind-2",
		},
		Spec: kubefloworgv1beta1.WorkspaceKindSpec{
			Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
				DisplayName: "Kind Two",
			},
		},
	}

	t.Run("success with multiple kinds", func(t *testing.T) {
		repo := newTestWorkspaceKindRepository(workspaceKind1, workspaceKind2)
		kinds, err := repo.GetWorkspaceKinds(ctx)

		assert.NoError(t, err)
		assert.Len(t, kinds, 2)

		// Create expected models for comparison
		expectedModels := []models.WorkspaceKind{
			models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind1),
			models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind2),
		}

		assert.ElementsMatch(t, expectedModels, kinds)
	})

	t.Run("success with no kinds", func(t *testing.T) {
		repo := newTestWorkspaceKindRepository() // No objects
		kinds, err := repo.GetWorkspaceKinds(ctx)

		assert.NoError(t, err)
		assert.Len(t, kinds, 0)
		assert.Empty(t, kinds)
	})
}
