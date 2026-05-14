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
		meta := &metav1.ObjectMeta{
			CreationTimestamp: metav1.Now(),
		}
		UpdateObjectMetaForCreate(meta, &user.DefaultInfo{Name: "alice"})

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{
			AnnotationCreatedBy: "alice",
			AnnotationUpdatedBy: "alice",
		}))
	})

	It("skips created-by and updated-by when actor is nil", func() {
		meta := &metav1.ObjectMeta{
			CreationTimestamp: metav1.Now(),
		}
		UpdateObjectMetaForCreate(meta, nil)

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{}))
	})

	It("initializes annotations map when nil", func() {
		meta := &metav1.ObjectMeta{
			Annotations:       nil,
			CreationTimestamp: metav1.Now(),
		}
		UpdateObjectMetaForCreate(meta, nil)

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{}))
	})

	It("panics when objectMeta is nil", func() {
		Expect(func() {
			UpdateObjectMetaForCreate(nil, &user.DefaultInfo{Name: "alice"})
		}).To(Panic())
	})
})

var _ = Describe("UpdateObjectMetaForUpdate", func() {
	It("correctly set updated-by for new user", func() {
		createTime := metav1.Now()
		meta := &metav1.ObjectMeta{
			Annotations: map[string]string{
				AnnotationCreatedBy: "alice",
				AnnotationUpdatedBy: "alice",
				AnnotationUpdatedAt: createTime.Format(time.RFC3339),
			},
			CreationTimestamp: createTime,
		}
		updateTime := createTime.Add(1 * time.Hour)
		UpdateObjectMetaForUpdate(meta, &user.DefaultInfo{Name: "bob"}, updateTime)

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{
			AnnotationCreatedBy: "alice",
			AnnotationUpdatedBy: "bob",
			AnnotationUpdatedAt: updateTime.Format(time.RFC3339),
		}))
	})

	It("remove updated-by when actor is nil", func() {
		createTime := metav1.Now()
		meta := &metav1.ObjectMeta{
			Annotations: map[string]string{
				AnnotationCreatedBy: "alice",
				AnnotationUpdatedBy: "alice",
				AnnotationUpdatedAt: createTime.Format(time.RFC3339),
			},
			CreationTimestamp: createTime,
		}
		updateTime := createTime.Add(1 * time.Hour)
		UpdateObjectMetaForUpdate(meta, nil, updateTime)

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{
			AnnotationCreatedBy: "alice",
			AnnotationUpdatedAt: updateTime.Format(time.RFC3339),
		}))
	})

	It("remove updated-by when actor is nil, and dont set created-by", func() {
		createTime := metav1.Now()
		meta := &metav1.ObjectMeta{
			Annotations: map[string]string{
				AnnotationUpdatedBy: "alice",
				AnnotationUpdatedAt: createTime.Format(time.RFC3339),
			},
			CreationTimestamp: createTime,
		}
		updateTime := createTime.Add(1 * time.Hour)
		UpdateObjectMetaForUpdate(meta, nil, updateTime)

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{
			AnnotationUpdatedAt: updateTime.Format(time.RFC3339),
		}))
	})

	It("initializes annotations map when nil", func() {
		createTime := metav1.Now()
		meta := &metav1.ObjectMeta{
			Annotations:       nil,
			CreationTimestamp: createTime,
		}
		updateTime := createTime.Add(1 * time.Hour)
		UpdateObjectMetaForUpdate(meta, &user.DefaultInfo{Name: "alice"}, updateTime)

		Expect(meta.Annotations).To(BeEquivalentTo(map[string]string{
			AnnotationUpdatedBy: "alice",
			AnnotationUpdatedAt: updateTime.Format(time.RFC3339),
		}))
	})

	It("panics when objectMeta is nil", func() {
		Expect(func() {
			UpdateObjectMetaForUpdate(nil, &user.DefaultInfo{Name: "alice"}, time.Now())
		}).To(Panic())
	})
})
