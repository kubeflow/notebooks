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

package common

import (
	"testing"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authentication/user"
)

func TestCommon(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Common Models Suite")
}

var _ = Describe("UpdateObjectMetaForCreate", func() {
	It("sets created-by and updated-by for a real user", func() {
		meta := &metav1.ObjectMeta{}
		UpdateObjectMetaForCreate(meta, &user.DefaultInfo{Name: "alice"})

		Expect(meta.Annotations[AnnotationCreatedBy]).To(Equal("alice"))
		Expect(meta.Annotations[AnnotationUpdatedBy]).To(Equal("alice"))
	})

	It("skips created-by and updated-by when actor is nil", func() {
		meta := &metav1.ObjectMeta{}
		UpdateObjectMetaForCreate(meta, nil)

		Expect(meta.Annotations).NotTo(HaveKey(AnnotationCreatedBy))
		Expect(meta.Annotations).NotTo(HaveKey(AnnotationUpdatedBy))
	})

	It("still sets updated-at when actor is nil", func() {
		meta := &metav1.ObjectMeta{}
		UpdateObjectMetaForCreate(meta, nil)

		Expect(meta.Annotations).To(HaveKey(AnnotationUpdatedAt))
	})

	It("initializes annotations map when nil", func() {
		meta := &metav1.ObjectMeta{Annotations: nil}
		UpdateObjectMetaForCreate(meta, &user.DefaultInfo{Name: "alice"})

		Expect(meta.Annotations).NotTo(BeNil())
	})

	It("panics when objectMeta is nil", func() {
		Expect(func() {
			UpdateObjectMetaForCreate(nil, &user.DefaultInfo{Name: "alice"})
		}).To(Panic())
	})
})

var _ = Describe("UpdateObjectMetaForUpdate", func() {
	It("sets updated-by for a real user", func() {
		meta := &metav1.ObjectMeta{
			Annotations: map[string]string{AnnotationCreatedBy: "alice"},
		}
		UpdateObjectMetaForUpdate(meta, &user.DefaultInfo{Name: "bob"}, time.Now())

		Expect(meta.Annotations[AnnotationUpdatedBy]).To(Equal("bob"))
	})

	It("does not overwrite created-by", func() {
		meta := &metav1.ObjectMeta{
			Annotations: map[string]string{AnnotationCreatedBy: "alice"},
		}
		UpdateObjectMetaForUpdate(meta, &user.DefaultInfo{Name: "bob"}, time.Now())

		Expect(meta.Annotations[AnnotationCreatedBy]).To(Equal("alice"))
	})

	It("skips updated-by when actor is nil", func() {
		meta := &metav1.ObjectMeta{
			Annotations: map[string]string{AnnotationUpdatedBy: "alice"},
		}
		UpdateObjectMetaForUpdate(meta, nil, time.Now())

		Expect(meta.Annotations[AnnotationUpdatedBy]).To(Equal("alice"))
	})

	It("sets updated-at in RFC3339 format", func() {
		meta := &metav1.ObjectMeta{}
		now := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
		UpdateObjectMetaForUpdate(meta, &user.DefaultInfo{Name: "alice"}, now)

		Expect(meta.Annotations[AnnotationUpdatedAt]).To(Equal("2024-06-01T12:00:00Z"))
	})

	It("still sets updated-at when actor is nil", func() {
		meta := &metav1.ObjectMeta{}
		UpdateObjectMetaForUpdate(meta, nil, time.Now())

		Expect(meta.Annotations).To(HaveKey(AnnotationUpdatedAt))
	})

	It("initializes annotations map when nil", func() {
		meta := &metav1.ObjectMeta{Annotations: nil}
		UpdateObjectMetaForUpdate(meta, &user.DefaultInfo{Name: "alice"}, time.Now())

		Expect(meta.Annotations).NotTo(BeNil())
	})

	It("panics when objectMeta is nil", func() {
		Expect(func() {
			UpdateObjectMetaForUpdate(nil, &user.DefaultInfo{Name: "alice"}, time.Now())
		}).To(Panic())
	})
})
