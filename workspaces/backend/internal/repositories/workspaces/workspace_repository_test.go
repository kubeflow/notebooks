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

package workspaces

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

// newTestScheme creates a new runtime.Scheme and registers the necessary types.
func newTestScheme() *runtime.Scheme {
	scheme := runtime.NewScheme()
	// Add the types your controller uses to the scheme
	kubefloworgv1beta1.AddToScheme(scheme)
	return scheme
}

// newTestWorkspaceRepository initializes a WorkspaceRepository with a fake client.
func newTestWorkspaceRepository(initObjs ...client.Object) *WorkspaceRepository {
	scheme := newTestScheme()
	cl := fake.NewClientBuilder().WithScheme(scheme).WithObjects(initObjs...).Build()
	return NewWorkspaceRepository(cl)
}

func TestGetWorkspace(t *testing.T) {
	ctx := context.Background()
	namespace := "test-ns"
	workspaceName := "test-ws"
	workspaceKindName := "test-kind"

	// Pre-create objects for the test cases
	testWorkspaceKind := &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: workspaceKindName,
		},
	}
	testWorkspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceName,
			Namespace: namespace,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Kind: workspaceKindName,
		},
	}

	testCases := []struct {
		name          string
		namespace     string
		workspaceName string
		initObjs      []client.Object
		wantWorkspace models.Workspace
		wantErr       error
	}{
		{
			name:          "Workspace and Kind found",
			namespace:     namespace,
			workspaceName: workspaceName,
			initObjs:      []client.Object{testWorkspace, testWorkspaceKind},
			wantWorkspace: models.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind),
			wantErr:       nil,
		},
		{
			name:          "Workspace found, Kind not found",
			namespace:     namespace,
			workspaceName: workspaceName,
			initObjs:      []client.Object{testWorkspace}, // Kind is missing
			wantWorkspace: models.NewWorkspaceModelFromWorkspace(testWorkspace, &kubefloworgv1beta1.WorkspaceKind{}),
			wantErr:       nil, // Should not return an error
		},
		{
			name:          "Workspace not found",
			namespace:     namespace,
			workspaceName: "non-existent-ws",
			initObjs:      []client.Object{},
			wantErr:       ErrWorkspaceNotFound,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			r := newTestWorkspaceRepository(tc.initObjs...)
			gotWorkspace, err := r.GetWorkspace(ctx, tc.namespace, tc.workspaceName)

			assert.Equal(t, tc.wantErr, err)
			if tc.wantErr == nil {
				assert.Equal(t, tc.wantWorkspace, gotWorkspace)
			}
		})
	}
}

func TestGetWorkspaces(t *testing.T) {
	ctx := context.Background()
	ns1 := "ns1"
	ns2 := "ns2"
	wsKind1 := &kubefloworgv1beta1.WorkspaceKind{ObjectMeta: metav1.ObjectMeta{Name: "kind1"}}
	ws1 := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws1", Namespace: ns1}, Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "kind1"}}
	ws2 := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws2", Namespace: ns1}, Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "kind-nonexistent"}}
	ws3 := &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws3", Namespace: ns2}, Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "kind1"}}

	r := newTestWorkspaceRepository(ws1, ws2, ws3, wsKind1)

	t.Run("GetWorkspaces in namespace", func(t *testing.T) {
		workspaces, err := r.GetWorkspaces(ctx, ns1)
		require.NoError(t, err)
		require.Len(t, workspaces, 2)
		// Order is not guaranteed, so check for presence
		assert.Contains(t, workspaces, models.NewWorkspaceModelFromWorkspace(ws1, wsKind1))
		assert.Contains(t, workspaces, models.NewWorkspaceModelFromWorkspace(ws2, &kubefloworgv1beta1.WorkspaceKind{}))
	})

	t.Run("GetWorkspaces in empty namespace", func(t *testing.T) {
		workspaces, err := r.GetWorkspaces(ctx, "empty-ns")
		require.NoError(t, err)
		assert.Empty(t, workspaces)
	})

	t.Run("GetAllWorkspaces in cluster", func(t *testing.T) {
		workspaces, err := r.GetAllWorkspaces(ctx)
		require.NoError(t, err)
		require.Len(t, workspaces, 3)
		assert.Contains(t, workspaces, models.NewWorkspaceModelFromWorkspace(ws1, wsKind1))
		assert.Contains(t, workspaces, models.NewWorkspaceModelFromWorkspace(ws2, &kubefloworgv1beta1.WorkspaceKind{}))
		assert.Contains(t, workspaces, models.NewWorkspaceModelFromWorkspace(ws3, wsKind1))
	})
}

func TestCreateWorkspace(t *testing.T) {
	ctx := context.Background()
	namespace := "create-ns"
	workspaceName := "new-ws"
	workspaceCreate := &models.WorkspaceCreate{
		Name: workspaceName,
		Kind: "new-kind",
		PodTemplate: models.PodTemplateMutate{
			PodMetadata: models.PodMetadataMutate{
				Labels:      map[string]string{"foo": "bar"},
				Annotations: map[string]string{},
			},
			Volumes: models.PodVolumesMutate{
				Home:    nil,
				Data:    []models.PodVolumeMount{},
				Secrets: nil,
			},
		},
	}

	testCases := []struct {
		name         string
		initObjs     []client.Object
		workspace    *models.WorkspaceCreate
		namespace    string
		wantModel    *models.WorkspaceCreate
		wantErr      error
		checkCreated bool
	}{
		{
			name:         "Successful creation",
			initObjs:     []client.Object{},
			workspace:    workspaceCreate,
			namespace:    namespace,
			wantModel:    workspaceCreate,
			wantErr:      nil,
			checkCreated: true,
		},
		{
			name: "Workspace already exists",
			initObjs: []client.Object{&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespace},
			}},
			workspace:    workspaceCreate,
			namespace:    namespace,
			wantModel:    nil,
			wantErr:      ErrWorkspaceAlreadyExists,
			checkCreated: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			r := newTestWorkspaceRepository(tc.initObjs...)
			createdModel, err := r.CreateWorkspace(ctx, tc.workspace, tc.namespace)

			assert.Equal(t, tc.wantErr, err)
			assert.Equal(t, tc.wantModel, createdModel)

			if tc.checkCreated {
				// Verify that the workspace was actually created in the fake client
				createdWs := &kubefloworgv1beta1.Workspace{}
				err := r.client.Get(ctx, types.NamespacedName{Name: tc.workspace.Name, Namespace: tc.namespace}, createdWs)
				require.NoError(t, err)
				assert.Equal(t, tc.workspace.Name, createdWs.Name)
				assert.Equal(t, tc.workspace.Kind, createdWs.Spec.Kind)
				assert.Equal(t, tc.workspace.PodTemplate.PodMetadata.Labels, createdWs.Spec.PodTemplate.PodMetadata.Labels)
			}
		})
	}
}

func TestDeleteWorkspace(t *testing.T) {
	ctx := context.Background()
	namespace := "delete-ns"
	workspaceName := "deletable-ws"

	testWorkspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceName,
			Namespace: namespace,
		},
	}

	testCases := []struct {
		name          string
		initObjs      []client.Object
		namespace     string
		workspaceName string
		wantErr       error
		checkDeleted  bool
	}{
		{
			name:          "Successful deletion",
			initObjs:      []client.Object{testWorkspace},
			namespace:     namespace,
			workspaceName: workspaceName,
			wantErr:       nil,
			checkDeleted:  true,
		},
		{
			name:          "Workspace not found",
			initObjs:      []client.Object{},
			namespace:     namespace,
			workspaceName: "non-existent-ws",
			wantErr:       ErrWorkspaceNotFound,
			checkDeleted:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			r := newTestWorkspaceRepository(tc.initObjs...)
			err := r.DeleteWorkspace(ctx, tc.namespace, tc.workspaceName)

			assert.Equal(t, tc.wantErr, err)

			if tc.checkDeleted {
				// Verify the workspace is gone
				deletedWs := &kubefloworgv1beta1.Workspace{}
				err := r.client.Get(ctx, types.NamespacedName{Name: tc.workspaceName, Namespace: tc.namespace}, deletedWs)
				assert.True(t, apierrors.IsNotFound(err))
			}
		})
	}
}
