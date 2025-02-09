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
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
)

// ValidationError represents a field-specific validation error.
type ValidationError struct {
	Field   string
	Message string
}

// Field represents a field's value and its type for validation.
type Field struct {
	Value string
	Type  string
}

// Error generates an error message for a given validation error.
func Error(err *ValidationError) error {
	return fmt.Errorf("request validation failed on %s: %s", err.Field, err.Message)
}

// Validator defines the interface for field validation.
type Validator interface {
	Validate(field *Field) error
}

// NotNullValidator ensures the field value is not empty.
type NotNullValidator struct{}

func (v *NotNullValidator) Validate(field *Field) error {
	if field.Value == "" {
		return Error(&ValidationError{
			Field:   field.Type,
			Message: fmt.Sprintf("%s cannot be empty", field.Type),
		})
	}
	return nil
}

// DNSLabelValidator validates that the field value conforms to DNS label standards.
type DNSLabelValidator struct{}

func (v *DNSLabelValidator) Validate(field *Field) error {
	if errors := validation.IsDNS1123Label(field.Value); errors != nil {
		return Error(&ValidationError{
			Field:   field.Type,
			Message: strings.Join(errors, "; "),
		})
	}
	return nil
}

// DNSSubdomainValidator validates that the field value conforms to DNS subdomain standards.
type DNSSubdomainValidator struct{}

func (v *DNSSubdomainValidator) Validate(field *Field) error {
	if errors := validation.IsDNS1123Subdomain(field.Value); errors != nil {
		return Error(&ValidationError{
			Field:   field.Type,
			Message: strings.Join(errors, "; "),
		})
	}
	return nil
}

// ValidateWorkspace validates namespace and name of a workspace.
func ValidateWorkspace(namespace string, workspaceName string) error {
	if err := ValidateNamespace(namespace, true); err != nil {
		return err
	}

	if err := ValidateWorkspaceName(workspaceName); err != nil {
		return err
	}

	return nil
}

// ValidateNamespace validates the namespace field, ensuring it is not null (if required)
// and conforms to DNS label standards.
func ValidateNamespace(namespace string, required bool) error {
	if !required && namespace == "" {
		return nil
	}

	field := Field{namespace, "namespace"}
	validators := []Validator{
		&NotNullValidator{},
		&DNSLabelValidator{},
	}
	return runValidators(&field, validators)
}

// ValidateWorkspaceName validates the workspace name, ensuring it is not null
// and conforms to DNS label standards.
func ValidateWorkspaceName(workspaceName string) error {
	field := Field{workspaceName, "workspace"}
	validators := []Validator{
		&NotNullValidator{},
		&DNSLabelValidator{},
	}
	return runValidators(&field, validators)
}

// ValidateWorkspaceKind validates the workspace kind, ensuring it is not null
// and conforms to DNS subdomain standards.
func ValidateWorkspaceKind(param string) error {
	field := Field{param, "workspacekind"}
	validators := []Validator{
		&NotNullValidator{},
		&DNSSubdomainValidator{},
	}
	return runValidators(&field, validators)
}

// runValidators applies all validators to a given field.
func runValidators(field *Field, validators []Validator) error {
	for _, validator := range validators {
		if err := validator.Validate(field); err != nil {
			return err
		}
	}
	return nil
}
