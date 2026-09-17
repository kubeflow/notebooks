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
	"errors"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authentication/user"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

func TestWorkspaceRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Workspaces Repository Suite")
}

var _ = Describe("WorkspaceRepository.UpdateWorkspace", func() {
	const (
		wsName      = "my-workspace"
		wsNamespace = "my-namespace"
	)

	var (
		ctx    context.Context
		scheme *runtime.Scheme
		actor  user.Info
	)

	BeforeEach(func() {
		ctx = context.Background()
		scheme = runtime.NewScheme()
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
		actor = &user.DefaultInfo{Name: "test-user"}
	})

	newWorkspace := func() *kubefloworgv1beta1.Workspace {
		return &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:       wsName,
				Namespace:  wsNamespace,
				UID:        "test-workspace-uid",
				Generation: 1,
			},
			Spec: kubefloworgv1beta1.WorkspaceSpec{Kind: "jupyterlab"},
		}
	}

	buildClient := func(funcs interceptor.Funcs) client.WithWatch {
		return fake.NewClientBuilder().
			WithScheme(scheme).
			WithObjects(newWorkspace()).
			WithInterceptorFuncs(funcs).
			Build()
	}

	// the error the API server returns when `resourceVersion` does not match
	conflictErr := func() error {
		return apierrors.NewConflict(
			schema.GroupResource{Group: kubefloworgv1beta1.GroupVersion.Group, Resource: "workspaces"},
			wsName,
			errors.New("the object has been modified"),
		)
	}

	revisionOf := func(cl client.Reader) modelsCommon.RevisionString {
		stored := &kubefloworgv1beta1.Workspace{}
		Expect(cl.Get(ctx, client.ObjectKey{Namespace: wsNamespace, Name: wsName}, stored)).To(Succeed())
		return modelsCommon.CalculateRevision(&stored.ObjectMeta)
	}

	It("retries a conflicting update and succeeds", func() {
		attempts := 0
		cl := buildClient(interceptor.Funcs{
			Update: func(ctx context.Context, cli client.WithWatch, obj client.Object, opts ...client.UpdateOption) error {
				attempts++
				if attempts == 1 {
					return conflictErr()
				}
				return cli.Update(ctx, obj, opts...)
			},
		})
		repo := NewWorkspaceRepository(&config.EnvConfig{}, cl, cl)

		update := &models.WorkspaceUpdate{Revision: revisionOf(cl), DisplayName: "new name"}
		result, err := repo.UpdateWorkspace(ctx, actor, update, wsNamespace, wsName)

		Expect(err).NotTo(HaveOccurred())
		Expect(result).NotTo(BeNil())
		Expect(attempts).To(Equal(2))

		stored := &kubefloworgv1beta1.Workspace{}
		Expect(cl.Get(ctx, client.ObjectKey{Namespace: wsNamespace, Name: wsName}, stored)).To(Succeed())
		Expect(stored.Spec.DisplayName).To(HaveValue(Equal("new name")))
	})

	It("returns a kubernetes conflict once the retries are exhausted", func() {
		// the handler keys off apierrors.IsConflict to return a retriable 503 instead of a 500
		attempts := 0
		cl := buildClient(interceptor.Funcs{
			Update: func(ctx context.Context, cli client.WithWatch, obj client.Object, opts ...client.UpdateOption) error {
				attempts++
				return conflictErr()
			},
		})
		repo := NewWorkspaceRepository(&config.EnvConfig{}, cl, cl)

		update := &models.WorkspaceUpdate{Revision: revisionOf(cl)}
		_, err := repo.UpdateWorkspace(ctx, actor, update, wsNamespace, wsName)

		Expect(apierrors.IsConflict(err)).To(BeTrue())
		Expect(attempts).To(BeNumerically(">", 1))
	})

	It("rejects a stale caller revision without attempting a write", func() {
		attempts := 0
		cl := buildClient(interceptor.Funcs{
			Update: func(ctx context.Context, cli client.WithWatch, obj client.Object, opts ...client.UpdateOption) error {
				attempts++
				return cli.Update(ctx, obj, opts...)
			},
		})
		repo := NewWorkspaceRepository(&config.EnvConfig{}, cl, cl)

		update := &models.WorkspaceUpdate{Revision: "a-stale-revision"}
		_, err := repo.UpdateWorkspace(ctx, actor, update, wsNamespace, wsName)

		Expect(err).To(MatchError(ErrWorkspaceRevisionConflict))
		Expect(apierrors.IsConflict(err)).To(BeFalse())
		Expect(attempts).To(BeZero())
	})

	It("reads through the apiReader, not the cached client", func() {
		// a cached read is what produces the stale resourceVersion, and would stall the retry loop
		cachedGets, readerGets := 0, 0
		countGets := func(n *int) interceptor.Funcs {
			return interceptor.Funcs{
				Get: func(ctx context.Context, cli client.WithWatch, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
					if _, ok := obj.(*kubefloworgv1beta1.Workspace); ok {
						*n++
					}
					return cli.Get(ctx, key, obj, opts...)
				},
			}
		}
		cachedClient := buildClient(countGets(&cachedGets))
		apiReader := buildClient(countGets(&readerGets))
		repo := NewWorkspaceRepository(&config.EnvConfig{}, cachedClient, apiReader)

		update := &models.WorkspaceUpdate{Revision: revisionOf(apiReader)}
		readerGets = 0 // discount the read above

		_, err := repo.UpdateWorkspace(ctx, actor, update, wsNamespace, wsName)

		Expect(err).NotTo(HaveOccurred())
		Expect(readerGets).To(Equal(1))
		Expect(cachedGets).To(BeZero())
	})
})
