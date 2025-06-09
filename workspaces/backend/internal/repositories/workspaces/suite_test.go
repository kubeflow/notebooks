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

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestWorkspaceRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "WorkspaceRepository Suite")
}

func newTestScheme() *runtime.Scheme {
	scheme := runtime.NewScheme()
	_ = kubefloworgv1beta1.AddToScheme(scheme)
	return scheme
}

func newTestWorkspaceRepository(initObjs ...client.Object) *WorkspaceRepository {
	scheme := newTestScheme()
	cl := fake.NewClientBuilder().WithScheme(scheme).WithObjects(initObjs...).Build()
	return NewWorkspaceRepository(cl)
}

var _ = Describe("WorkspaceRepository", func() {
	var ctx context.Context

	BeforeEach(func() {
		ctx = context.Background()
	})

	Describe("GetWorkspace", func() {
		var (
			namespace         = "test-ns"
			workspaceName     = "test-ws"
			workspaceKindName = "test-kind"
			testWorkspaceKind *kubefloworgv1beta1.WorkspaceKind
			testWorkspace     *kubefloworgv1beta1.Workspace
		)

		BeforeEach(func() {
			testWorkspaceKind = &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			testWorkspace = &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespace},
				Spec:       kubefloworgv1beta1.WorkspaceSpec{Kind: workspaceKindName},
			}
		})

		It("returns the workspace and kind if both exist", func() {
			r := newTestWorkspaceRepository(testWorkspace, testWorkspaceKind)
			ws, err := r.GetWorkspace(ctx, namespace, workspaceName)
			Expect(err).NotTo(HaveOccurred())
			Expect(ws).To(Equal(workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)))
		})

		It("returns the workspace even if kind is missing", func() {
			r := newTestWorkspaceRepository(testWorkspace)
			ws, err := r.GetWorkspace(ctx, namespace, workspaceName)
			Expect(err).NotTo(HaveOccurred())
			Expect(ws).To(Equal(workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, &kubefloworgv1beta1.WorkspaceKind{})))
		})

		It("returns an error if the workspace does not exist", func() {
			r := newTestWorkspaceRepository()
			_, err := r.GetWorkspace(ctx, namespace, "non-existent")
			Expect(err).To(Equal(ErrWorkspaceNotFound))
		})
	})

	Describe("GetWorkspaces", func() {
		var (
			ns1     = "ns1"
			ns2     = "ns2"
			wsKind1 = &kubefloworgv1beta1.WorkspaceKind{ObjectMeta: metav1.ObjectMeta{Name: "kind1"}}
			wsKind2 = &kubefloworgv1beta1.WorkspaceKind{ObjectMeta: metav1.ObjectMeta{Name: "kind2"}}
			ws1     = &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws1", Namespace: ns1}, Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "kind1"}}
			ws2     = &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws2", Namespace: ns1}, Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "kind2"}}
			ws3     = &kubefloworgv1beta1.Workspace{ObjectMeta: metav1.ObjectMeta{Name: "ws3", Namespace: ns2}, Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "kind1"}}
		)

		It("gets all workspaces in a namespace", func() {
			r := newTestWorkspaceRepository(ws1, ws2, ws3, wsKind1, wsKind2)
			wss, err := r.GetWorkspaces(ctx, ns1)
			Expect(err).NotTo(HaveOccurred())
			Expect(wss).To(HaveLen(2))
			Expect(wss).To(ContainElements(
				workspaces.NewWorkspaceModelFromWorkspace(ws1, wsKind1),
				workspaces.NewWorkspaceModelFromWorkspace(ws2, wsKind2),
			))
		})

		It("returns empty list when namespace has no workspaces", func() {
			r := newTestWorkspaceRepository(ws1, ws2, ws3, wsKind1, wsKind2)
			wss, err := r.GetWorkspaces(ctx, "nonexistent-ns")
			Expect(err).NotTo(HaveOccurred())
			Expect(wss).To(BeEmpty())
		})

		It("returns all workspaces in the cluster", func() {
			r := newTestWorkspaceRepository(ws1, ws2, ws3, wsKind1, wsKind2)
			wss, err := r.GetAllWorkspaces(ctx)
			Expect(err).NotTo(HaveOccurred())
			Expect(wss).To(HaveLen(3))
			Expect(wss).To(ContainElements(
				workspaces.NewWorkspaceModelFromWorkspace(ws1, wsKind1),
				workspaces.NewWorkspaceModelFromWorkspace(ws2, wsKind2),
				workspaces.NewWorkspaceModelFromWorkspace(ws3, wsKind1),
			))
		})
	})

	Describe("CreateWorkspace", func() {
		var (
			namespace       = "create-ns"
			workspaceName   = "new-ws"
			workspaceCreate = &workspaces.WorkspaceCreate{
				Name: workspaceName,
				Kind: "new-kind",
				PodTemplate: workspaces.PodTemplateMutate{
					PodMetadata: workspaces.PodMetadataMutate{
						Labels:      map[string]string{"foo": "bar"},
						Annotations: map[string]string{},
					},
					Volumes: workspaces.PodVolumesMutate{
						Data: []workspaces.PodVolumeMount{},
					},
				},
			}
		)

		It("creates a workspace successfully", func() {
			r := newTestWorkspaceRepository()
			result, err := r.CreateWorkspace(ctx, workspaceCreate, namespace)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(Equal(workspaceCreate))

			created := &kubefloworgv1beta1.Workspace{}
			err = r.client.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespace}, created)
			Expect(err).NotTo(HaveOccurred())
			Expect(created.Spec.Kind).To(Equal(workspaceCreate.Kind))
			Expect(created.Spec.PodTemplate.PodMetadata.Labels).To(Equal(workspaceCreate.PodTemplate.PodMetadata.Labels))
		})

		It("returns error if workspace already exists", func() {
			existing := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespace},
			}
			r := newTestWorkspaceRepository(existing)
			result, err := r.CreateWorkspace(ctx, workspaceCreate, namespace)
			Expect(err).To(Equal(ErrWorkspaceAlreadyExists))
			Expect(result).To(BeNil())
		})
	})

	Describe("DeleteWorkspace", func() {
		var (
			namespace     = "delete-ns"
			workspaceName = "deletable-ws"
			testWorkspace = &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespace,
				},
			}
		)

		It("successfully deletes an existing workspace", func() {
			r := newTestWorkspaceRepository(testWorkspace)
			err := r.DeleteWorkspace(ctx, namespace, workspaceName)
			Expect(err).NotTo(HaveOccurred())

			ws := &kubefloworgv1beta1.Workspace{}
			err = r.client.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespace}, ws)
			Expect(apierrors.IsNotFound(err)).To(BeTrue())
		})

		It("returns error when deleting non-existent workspace", func() {
			r := newTestWorkspaceRepository()
			err := r.DeleteWorkspace(ctx, namespace, "non-existent")
			Expect(err).To(Equal(ErrWorkspaceNotFound))
		})
	})
})
