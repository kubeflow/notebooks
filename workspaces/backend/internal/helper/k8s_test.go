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
	"context"
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/runtime/schema"
	toolscache "k8s.io/client-go/tools/cache"
	"sigs.k8s.io/controller-runtime/pkg/cache/informertest"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllertest"
)

var _ = Describe("WarmUpCaches", func() {

	var (
		ctx            context.Context
		mgrCache       *informertest.FakeInformers
		configMapCache *informertest.FakeInformers
	)

	BeforeEach(func() {
		ctx = context.Background()

		scheme, err := BuildScheme()
		Expect(err).NotTo(HaveOccurred())

		synced := true
		mgrCache = &informertest.FakeInformers{Scheme: scheme, Synced: &synced}
		configMapCache = &informertest.FakeInformers{Scheme: scheme, Synced: &synced}
	})

	It("starts an informer for every cached object type", func() {
		Expect(WarmUpCaches(ctx, time.Second, mgrCache, configMapCache)).To(Succeed())

		for _, obj := range cachedObjectTypes {
			_, err := mgrCache.FakeInformerFor(ctx, obj)
			Expect(err).NotTo(HaveOccurred())
		}
		Expect(mgrCache.InformersByGVK).To(HaveLen(len(cachedObjectTypes)))
	})

	It("returns an error naming the unsynced informers when the manager cache does not sync", func() {
		notSynced := false
		mgrCache.Synced = &notSynced
		workspaceGVK := schema.GroupVersionKind{
			Group:   kubefloworgv1beta1.GroupVersion.Group,
			Version: kubefloworgv1beta1.GroupVersion.Version,
			Kind:    "Workspace",
		}
		mgrCache.InformersByGVK = map[schema.GroupVersionKind]toolscache.SharedIndexInformer{
			workspaceGVK: controllertest.NewFakeInformer(),
		}

		err := WarmUpCaches(ctx, time.Second, mgrCache, configMapCache)
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("*v1beta1.Workspace"))
		Expect(err.Error()).NotTo(ContainSubstring("*v1beta1.WorkspaceKind"))
		Expect(err.Error()).NotTo(ContainSubstring("image source ConfigMaps"))
	})

	It("returns an error when the image source ConfigMap cache does not sync", func() {
		notSynced := false
		configMapCache.Synced = &notSynced

		err := WarmUpCaches(ctx, time.Second, mgrCache, configMapCache)
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("image source ConfigMaps"))
	})
})
