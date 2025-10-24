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

// SecretType represents the type of a secret
type SecretType string

// SecretValue represents a secret value with base64 encoding
type SecretValue struct {
	Base64 string `json:"base64,omitempty"`
}

// SecretData represents a map of secret key-value pairs
type SecretData map[string]SecretValue

// SecretBase represents the common fields shared between SecretCreate and SecretUpdate
type SecretBase struct {
	Type      SecretType `json:"type"`
	Immutable bool       `json:"immutable"`
	Contents  SecretData `json:"contents"`
}

// SecretCreate is used to create a new secret.
type SecretCreate struct {
	Name string `json:"name"`
	SecretBase
}

// SecretUpdate represents the request body for updating a secret
type SecretUpdate struct {
	SecretBase
}

// Validate validates the SecretCreate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to create the secret.
func (s *SecretCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the secret name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateFieldIsDNS1123Subdomain(namePath, s.Name)...)

	// validate common fields (type and contents)
	errs = append(errs, s.SecretBase.ValidateBase(prefix)...)

	return errs
}

// Validate validates the SecretUpdate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to update the secret.
func (s *SecretUpdate) Validate(prefix *field.Path) []*field.Error {
	// validate common fields (type and contents)
	return s.SecretBase.ValidateBase(prefix)
}

// ValidateContents validates the contents map of a secret.
func (s *SecretData) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	if s == nil {
		return errs // nil is valid for optional fields
	}

	for key, value := range *s {
		keyPath := prefix.Key(key)
		errs = append(errs, helper.ValidateFieldIsConfigMapKey(keyPath, key)...)

		// TODO: determine proper way to validate secret values
		// Only validate base64 if it's present
		if value.Base64 != "" {
			errs = append(errs, helper.ValidateFieldIsBase64Encoded(keyPath, value.Base64)...)
		}
	}

	return errs
}

// ValidateSecretType validates the secret type field.
// Currently only supports "Opaque" type, with empty type defaulting to "Opaque".
func (s *SecretType) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	if s == nil || *s == "" {
		return errs // nil or empty is valid for optional fields
	}

	// Currently only "Opaque" type is supported
	if *s != "Opaque" {
		errs = append(errs, field.Invalid(prefix, *s, "only 'Opaque' type is supported"))
	}

	return errs
}

// ValidateBase validates the common fields of a secret (type and contents).
func (sb *SecretBase) ValidateBase(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	typePath := prefix.Child("type")
	errs = append(errs, sb.Type.Validate(typePath)...)

	// Set default type if empty
	if sb.Type == "" {
		sb.Type = "Opaque"
	}

	contentsPath := prefix.Child("contents")
	errs = append(errs, sb.Contents.Validate(contentsPath)...)

	return errs
}
