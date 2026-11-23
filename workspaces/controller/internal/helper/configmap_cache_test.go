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
	"crypto/sha256"
	"encoding/hex"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("TransformConfigMapSHA256", func() {

	sha256Hex := func(data []byte) string {
		sum := sha256.Sum256(data)
		return hex.EncodeToString(sum[:])
	}

	It("should compute SHA256 virtual annotations for Data and BinaryData keys", func() {
		transform := TransformConfigMapSHA256()
		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "icon-cm",
				Namespace: "kubeflow",
			},
			Data: map[string]string{
				"logo.svg": "<svg></svg>",
			},
			BinaryData: map[string][]byte{
				"icon.png": {0x89, 0x50, 0x4e, 0x47},
			},
		}

		out, err := transform(cm)
		Expect(err).NotTo(HaveOccurred())

		transformed, ok := out.(*corev1.ConfigMap)
		Expect(ok).To(BeTrue())
		Expect(transformed.Annotations).To(HaveKeyWithValue(
			SHA256AnnotationPrefix+"logo.svg",
			sha256Hex([]byte("<svg></svg>")),
		))
		Expect(transformed.Annotations).To(HaveKeyWithValue(
			SHA256AnnotationPrefix+"icon.png",
			sha256Hex([]byte{0x89, 0x50, 0x4e, 0x47}),
		))
	})

	It("should preserve existing annotations on the ConfigMap", func() {
		transform := TransformConfigMapSHA256()
		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name: "icon-cm",
				Annotations: map[string]string{
					"example.com/existing": "keep-me",
				},
			},
			Data: map[string]string{
				"icon": "data",
			},
		}

		out, err := transform(cm)
		Expect(err).NotTo(HaveOccurred())

		transformed := out.(*corev1.ConfigMap)
		Expect(transformed.Annotations).To(HaveKeyWithValue("example.com/existing", "keep-me"))
		Expect(transformed.Annotations).To(HaveKeyWithValue(
			SHA256AnnotationPrefix+"icon",
			sha256Hex([]byte("data")),
		))
	})

	It("should handle empty ConfigMaps without error", func() {
		transform := TransformConfigMapSHA256()
		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "empty-cm"},
		}

		out, err := transform(cm)
		Expect(err).NotTo(HaveOccurred())

		transformed := out.(*corev1.ConfigMap)
		Expect(transformed.Annotations).To(BeEmpty())
	})

	It("should return non-ConfigMap Kubernetes objects unchanged", func() {
		transform := TransformConfigMapSHA256()
		secret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: "my-secret"},
		}

		out, err := transform(secret)
		Expect(err).NotTo(HaveOccurred())
		Expect(out).To(BeIdenticalTo(secret))
		Expect(secret.Annotations).To(BeNil())
	})

	It("should return non-Kubernetes objects unchanged", func() {
		transform := TransformConfigMapSHA256()
		input := "not-a-k8s-object"

		out, err := transform(input)
		Expect(err).NotTo(HaveOccurred())
		Expect(out).To(Equal(input))
	})
})
