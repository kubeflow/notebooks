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

package secrets

import (
	"encoding/base64"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

func TestSecrets(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Secrets Models Suite")
}

var _ = Describe("Secret Write Model Conversions", func() {

	Describe("NewSecretFromSecretCreateModel", func() {
		It("should create a labeled Kubernetes Secret with decoded base64 data", func() {
			encoded := base64.StdEncoding.EncodeToString([]byte("super-secret"))
			model := &SecretCreate{
				Name:      "my-secret",
				Type:      corev1.SecretTypeOpaque,
				Immutable: true,
				Contents: SecretData{
					"token": {Base64: ptr.To(encoded)},
				},
			}

			secret, err := NewSecretFromSecretCreateModel(model, "team-a")
			Expect(err).NotTo(HaveOccurred())
			Expect(secret.Name).To(Equal("my-secret"))
			Expect(secret.Namespace).To(Equal("team-a"))
			Expect(secret.Type).To(Equal(corev1.SecretTypeOpaque))
			Expect(secret.Immutable).To(Equal(ptr.To(true)))
			Expect(secret.Labels).To(HaveKeyWithValue(common.LabelCanMount, "true"))
			Expect(secret.Labels).To(HaveKeyWithValue(common.LabelCanUpdate, "true"))
			Expect(secret.Data).To(HaveKeyWithValue("token", []byte("super-secret")))
		})

		It("should return an error for invalid base64 content", func() {
			model := &SecretCreate{
				Name: "bad-secret",
				Contents: SecretData{
					"token": {Base64: ptr.To("!!!not-base64!!!")},
				},
			}

			secret, err := NewSecretFromSecretCreateModel(model, "team-a")
			Expect(err).To(HaveOccurred())
			Expect(secret).To(BeNil())
		})
	})

	Describe("ApplySecretUpdateModelToSecret", func() {
		It("should update provided keys, preserve nil keys, and delete omitted keys", func() {
			existing := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{Name: "my-secret"},
				Type:       corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"keep":   []byte("old-keep"),
					"update": []byte("old-val"),
					"remove": []byte("gone"),
				},
			}

			newEncoded := base64.StdEncoding.EncodeToString([]byte("new-val"))
			update := &SecretUpdate{
				Type:      corev1.SecretTypeOpaque,
				Immutable: true,
				Contents: SecretData{
					"keep":   {Base64: nil},
					"update": {Base64: ptr.To(newEncoded)},
				},
			}

			Expect(ApplySecretUpdateModelToSecret(update, existing)).To(Succeed())
			Expect(existing.Immutable).To(Equal(ptr.To(true)))
			Expect(existing.Data).To(HaveKeyWithValue("keep", []byte("old-keep")))
			Expect(existing.Data).To(HaveKeyWithValue("update", []byte("new-val")))
			Expect(existing.Data).NotTo(HaveKey("remove"))
		})

		It("should return an error on invalid base64 during update", func() {
			existing := &corev1.Secret{}
			update := &SecretUpdate{
				Contents: SecretData{
					"key": {Base64: ptr.To("%%%")},
				},
			}

			Expect(ApplySecretUpdateModelToSecret(update, existing)).To(HaveOccurred())
		})
	})

	Describe("NewSecretCreateModelFromSecret and NewSecretUpdateModelFromSecret", func() {
		It("should return key names with empty SecretValue to avoid exposing secret data", func() {
			secret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{Name: "api-keys"},
				Type:       corev1.SecretTypeOpaque,
				Data: map[string][]byte{
					"key1": []byte("sensitive-1"),
					"key2": []byte("sensitive-2"),
				},
			}

			createModel := NewSecretCreateModelFromSecret(secret)
			Expect(createModel.Name).To(Equal("api-keys"))
			Expect(createModel.Type).To(Equal(corev1.SecretTypeOpaque))
			Expect(createModel.Immutable).To(BeFalse())
			Expect(createModel.Contents).To(Equal(SecretData{
				"key1": {},
				"key2": {},
			}))

			updateModel := NewSecretUpdateModelFromSecret(secret)
			Expect(updateModel.Type).To(Equal(corev1.SecretTypeOpaque))
			Expect(updateModel.Immutable).To(BeFalse())
			Expect(updateModel.Contents).To(Equal(SecretData{
				"key1": {},
				"key2": {},
			}))
		})
	})
})
