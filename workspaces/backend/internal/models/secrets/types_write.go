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
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// SecretValue represents a secret value with base64 encoding
type SecretValue struct {
	Base64 *string `json:"base64,omitempty"`
}

// SecretData represents a map of secret key-value pairs
type SecretData map[string]SecretValue

// secretBase represents the common fields shared between SecretCreate and SecretUpdate
type secretBase struct {
	Type      string     `json:"type"`
	Immutable bool       `json:"immutable"`
	Contents  SecretData `json:"contents"`
}

// SecretCreate is used to create a new secret.
type SecretCreate struct {
	Name string `json:"name"`
	secretBase
}

// SecretUpdate represents the request body for updating a secret
type SecretUpdate struct {
	secretBase
}

// NewSecretCreate creates a new SecretCreate with the specified fields.
func NewSecretCreate(name, secretType string, immutable bool, contents SecretData) SecretCreate {
	return SecretCreate{
		Name: name,
		secretBase: secretBase{
			Type:      secretType,
			Immutable: immutable,
			Contents:  contents,
		},
	}
}

// NewSecretUpdate creates a new SecretUpdate with the specified fields.
func NewSecretUpdate(secretType string, immutable bool, contents SecretData) SecretUpdate {
	return SecretUpdate{
		secretBase: secretBase{
			Type:      secretType,
			Immutable: immutable,
			Contents:  contents,
		},
	}
}

// Validate validates the SecretCreate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to create the secret.
func (s *SecretCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the secret name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateKubernetesSecretName(namePath, s.Name)...)

	// validate common fields (type and contents)
	errs = append(errs, s.secretBase.validateBase(prefix)...)

	return errs
}

// Validate validates the SecretUpdate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to update the secret.
func (s *SecretUpdate) Validate(prefix *field.Path) []*field.Error {
	// validate common fields (type and contents)
	return s.secretBase.validateBase(prefix)
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

// validateBase validates the common fields of a secret (contents).
func (sb *secretBase) validateBase(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	contentsPath := prefix.Child("contents")
	errs = append(errs, sb.Contents.Validate(contentsPath)...)

	return errs
}
