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

// Validate validates the SecretValue struct.
func (s *SecretValue) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the base64 string, if it is not nil
	if s.Base64 != nil {
		base64Path := prefix.Child("base64")
		errs = append(errs, helper.ValidateFieldIsSecretBase64Value(base64Path, *s.Base64)...)
	}

	return errs
}

// SecretData represents a map of secret key-value pairs
type SecretData map[string]SecretValue

// Validate validates the SecretData struct.
func (s *SecretData) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	if s != nil {
		for key, value := range *s {
			// validate the key
			keyPath := prefix // to avoid confusing the key with the value, we don't use prefix.Child(key) here
			errs = append(errs, helper.ValidateFieldIsConfigMapKey(keyPath, key)...)

			// validate the value
			valuePath := prefix.Key(key)
			errs = append(errs, value.Validate(valuePath)...)
		}
	}

	return errs
}

// SecretCreate is used to create a new secret.
type SecretCreate struct {
	Name      string            `json:"name"`
	Type      corev1.SecretType `json:"type"`
	Immutable bool              `json:"immutable"`
	Contents  SecretData        `json:"contents"`
}

// Validate validates the SecretCreate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to create the secret.
func (s *SecretCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error //nolint:prealloc

	// validate the secret name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateKubernetesSecretName(namePath, s.Name)...)

	// validate the secret contents
	contentsPath := prefix.Child("contents")
	errs = append(errs, s.Contents.Validate(contentsPath)...)

	return errs
}

// SecretUpdate represents the request body for updating a secret.
type SecretUpdate struct {
	Type      corev1.SecretType `json:"type"`
	Immutable bool              `json:"immutable"`
	// Update semantics:
	//   - key present with {"base64": "..."} → set/update the value
	//   - key present with {} (Base64 is nil) → preserve the existing value from currentSecret.Data
	//   - key omitted from the request → delete that key
	Contents SecretData `json:"contents"`
}

// Validate validates the SecretUpdate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to update the secret.
func (s *SecretUpdate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error //nolint:prealloc

	// validate the secret contents
	contentsPath := prefix.Child("contents")
	errs = append(errs, s.Contents.Validate(contentsPath)...)

	return errs
}
