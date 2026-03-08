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
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// SecretValue represents a secret value with base64 encoding
type SecretValue struct {
	Base64 *string `json:"base64,omitempty"`
}

// SecretData represents a map of secret key-value pairs
type SecretData map[string]SecretValue

// SecretCreate is used to create a new secret.
type SecretCreate struct {
	Name      string            `json:"name"`
	Type      corev1.SecretType `json:"type"`
	Immutable bool              `json:"immutable"`
	Contents  SecretData        `json:"contents"`
}

// SecretUpdate represents the request body for updating a secret.
type SecretUpdate struct {
	Type      corev1.SecretType `json:"type"`
	Immutable bool              `json:"immutable"`
	Contents  SecretData        `json:"contents"`
}

// Validate validates the SecretCreate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to create the secret.
func (s *SecretCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error
	errs = append(errs, helper.ValidateKubernetesSecretName(prefix.Child("name"), s.Name)...)
	errs = append(errs, s.Contents.Validate(prefix.Child("contents"))...)
	return errs
}

// Validate validates the SecretUpdate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to update the secret.
func (s *SecretUpdate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error
	errs = append(errs, s.Contents.Validate(prefix.Child("contents"))...)
	return errs
}

// Validate validates the SecretData struct.
func (s *SecretData) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	if s == nil {
		return errs // nil is valid for optional fields
	}

	for key := range *s {
		// TODO: come up with a better way to highlight the error is on the key not the value at that key
		keyPath := prefix.Child(key)
		errs = append(errs, helper.ValidateFieldIsConfigMapKey(keyPath, key)...)
	}

	return errs
}
