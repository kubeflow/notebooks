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
	"net/http"
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func TestValidation(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Validation Helper Suite")
}

type testError struct {
	message string
}

func (e *testError) Error() string {
	return e.message
}

var _ = Describe("Validation Helper Functions", func() {

	// Centralized test cases for DNS1123 Subdomain validation
	// Used by: ValidateWorkspaceName, ValidateWorkspaceKindName, ValidateKubernetesSecretName
	var (
		validDNS1123SubdomainNames = []string{
			"a",                             // single character
			"my-resource",                   // basic name with dash
			"resource-123",                  // name with numbers
			"resource-name-with-many-parts", // long name with multiple dashes
			"123-resource",                  // can start with number
			"123",                           // can be all numbers
			"resource.name",                 // dots ARE allowed in DNS1123 subdomain
			"resource.name.with.many.parts", // DNS1123 subdomains can have multiple parts separated by dots
		}
		invalidDNS1123SubdomainNames = []string{
			"",
			"Resource-Name", // uppercase not allowed
			"-resource",     // cannot start with dash
			"resource-",     // cannot end with dash
			"resource_name", // underscores not allowed
			"resource/name", // slashes not allowed in DNS1123 subdomain
		}
	)

	// Centralized test cases for DNS1123 Label validation
	// Used by: ValidateKubernetesNamespaceName, ValidateKubernetesServicesName
	// NOTE: Labels are more restrictive than subdomains - they do NOT allow dots
	var (
		validDNS1123LabelNames = []string{
			"a",                             // single character
			"my-resource",                   // basic name with dash
			"resource-123",                  // name with numbers
			"resource-name-with-many-parts", // long name with multiple dashes
			"123-resource",                  // can start with number
			"123",                           // can be all numbers
		}
		invalidDNS1123LabelNames = []string{
			"",
			"Resource-Name", // uppercase not allowed
			"-resource",     // cannot start with dash
			"resource-",     // cannot end with dash
			"resource.name", // dots not allowed in DNS1123 label
			"resource_name", // underscores not allowed in DNS1123 label
			"resource/name", // slashes not allowed in DNS1123 label
		}
	)

	// Centralized test cases for Kubernetes label/annotation keys
	// Both labels and annotations share the same key constraints:
	// Format: <optional DNS-1123 subdomain>/<name>
	// - The prefix (before /) is optional and must be a DNS-1123 subdomain (dots allowed)
	// - The name (after /) is required and must be a DNS-1123 label (with slightly relaxed rules)
	// Used by: ValidateKubernetesLabels, ValidateKubernetesAnnotations
	var (
		validLabelAnnotationKeys = []string{
			"app",                    // simple lowercase key (no prefix)
			"app.kubernetes.io/name", // standard Kubernetes namespaced prefix with slash
			"key.with.dots",          // dots are allowed in keys (DNS-1123 subdomain format)
			"key_with_underscores",   // underscores are allowed in keys
			"UPPERCASE",              // uppercase is allowed in keys
			"123numeric",             // can start with number
			"mixedCase123",           // mixed case and numbers
		}
		invalidLabelAnnotationKeys = []string{
			"",                   // empty key not allowed
			"-invalid",           // cannot start with dash
			"invalid-",           // cannot end with dash
			"app.kubernetes.io/", // cannot end with slash (name part after / is required)
		}
	)

	Describe("ValidateFieldIsNotEmpty", func() {
		const fieldName = "test"

		type testCase struct {
			description string
			value       string
			expectError bool
		}

		testCases := []testCase{
			{
				description: "should return no errors for non-empty string",
				value:       "non-empty",
				expectError: false,
			},
			{
				description: "should return required error for empty string",
				value:       "",
				expectError: true,
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				path := field.NewPath(fieldName)
				errs := ValidateFieldIsNotEmpty(path, tc.value)
				if tc.expectError {
					Expect(errs).To(HaveLen(1))
					Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired))
					Expect(errs[0].Field).To(Equal(fieldName))
				} else {
					Expect(errs).To(BeEmpty())
				}
			})
		}
	})

	Describe("ValidateWorkspaceName", func() {
		type testCase struct {
			description string
			name        string
			shouldPass  bool
		}

		testCases := []testCase{}

		for _, name := range validDNS1123SubdomainNames {
			testCases = append(testCases, testCase{
				description: "should accept valid workspace names",
				name:        name,
				shouldPass:  true,
			})
		}

		for _, name := range invalidDNS1123SubdomainNames {
			testCases = append(testCases, testCase{
				description: "should reject invalid workspace names",
				name:        name,
				shouldPass:  false,
			})
		}

		const fieldName = "name"
		for _, tc := range testCases {
			It(tc.description+" - "+tc.name, func() {
				path := field.NewPath(fieldName)
				errs := ValidateWorkspaceName(path, tc.name)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "workspace name %q should be valid", tc.name)
				} else {
					Expect(errs).To(HaveLen(1), "workspace name %q should return exactly one error", tc.name)
					if tc.name == "" {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired), "workspace name %q should return Required error type for empty string", tc.name)
					} else {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid), "workspace name %q should return Invalid error type", tc.name)
						Expect(errs[0].BadValue).To(Equal(tc.name), "workspace name %q error BadValue should match input", tc.name)
					}
					Expect(errs[0].Field).To(Equal(fieldName), "workspace name %q error should be on %q field", tc.name, fieldName)
				}
			})
		}
	})

	Describe("ValidateWorkspaceKindName", func() {
		type testCase struct {
			description string
			name        string
			shouldPass  bool
		}

		testCases := []testCase{}

		for _, name := range validDNS1123SubdomainNames {
			testCases = append(testCases, testCase{
				description: "should accept valid workspace kind names",
				name:        name,
				shouldPass:  true,
			})
		}

		for _, name := range invalidDNS1123SubdomainNames {
			testCases = append(testCases, testCase{
				description: "should reject invalid workspace kind names",
				name:        name,
				shouldPass:  false,
			})
		}

		const fieldName = "kind"
		for _, tc := range testCases {
			It(tc.description+" - "+tc.name, func() {
				path := field.NewPath(fieldName)
				errs := ValidateWorkspaceKindName(path, tc.name)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "workspace kind name %q should be valid", tc.name)
				} else {
					Expect(errs).To(HaveLen(1), "workspace kind name %q should return exactly one error", tc.name)
					if tc.name == "" {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired), "workspace kind name %q should return Required error type for empty string", tc.name)
					} else {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid), "workspace kind name %q should return Invalid error type", tc.name)
						Expect(errs[0].BadValue).To(Equal(tc.name), "workspace kind name %q error BadValue should match input", tc.name)
					}
					Expect(errs[0].Field).To(Equal(fieldName), "workspace kind name %q error should be on %q field", tc.name, fieldName)
				}
			})
		}
	})

	Describe("ValidateWorkspaceKindGVK", func() {
		validAPIVersion := kubefloworgv1beta1.GroupVersion.String()
		const validKind = "WorkspaceKind"

		type testCase struct {
			description string
			apiVersion  string
			kind        string
			validate    func(field.ErrorList)
		}

		testCases := []testCase{
			{
				description: "should accept valid GVK",
				apiVersion:  validAPIVersion,
				kind:        validKind,
				validate: func(errs field.ErrorList) {
					Expect(errs).To(BeEmpty())
				},
			},
			{
				description: "should reject empty apiVersion",
				apiVersion:  "",
				kind:        validKind,
				validate: func(errs field.ErrorList) {
					Expect(errs).To(HaveLen(1))
					Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired))
					Expect(errs[0].Field).To(Equal("apiVersion"))
				},
			},
			{
				description: "should reject empty kind",
				apiVersion:  validAPIVersion,
				kind:        "",
				validate: func(errs field.ErrorList) {
					Expect(errs).To(HaveLen(1))
					Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired))
					Expect(errs[0].Field).To(Equal("kind"))
				},
			},
			{
				description: "should reject invalid apiVersion",
				apiVersion:  "invalid/v1",
				kind:        validKind,
				validate: func(errs field.ErrorList) {
					Expect(errs).To(HaveLen(1))
					Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid))
					Expect(errs[0].Field).To(Equal("apiVersion"))
				},
			},
			{
				description: "should reject invalid kind",
				apiVersion:  validAPIVersion,
				kind:        "InvalidKind",
				validate: func(errs field.ErrorList) {
					Expect(errs).To(HaveLen(1))
					Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid))
					Expect(errs[0].Field).To(Equal("kind"))
				},
			},
			{
				description: "should return multiple errors for both invalid apiVersion and kind",
				apiVersion:  "invalid/v1",
				kind:        "InvalidKind",
				validate: func(errs field.ErrorList) {
					Expect(errs).To(HaveLen(2))

					errorsByField := make(map[string]*field.Error)
					for i := range errs {
						errorsByField[errs[i].Field] = errs[i]
					}

					apiVersionErr, ok := errorsByField["apiVersion"]
					Expect(ok).To(BeTrue(), "should have apiVersion error")
					Expect(apiVersionErr.Type).To(Equal(field.ErrorTypeInvalid))
					Expect(apiVersionErr.BadValue).To(Equal("invalid/v1"))
					Expect(apiVersionErr.ErrorBody()).To(ContainSubstring("invalid apiVersion for a WorkspaceKind"))

					kindErr, ok := errorsByField["kind"]
					Expect(ok).To(BeTrue(), "should have kind error")
					Expect(kindErr.Type).To(Equal(field.ErrorTypeInvalid))
					Expect(kindErr.BadValue).To(Equal("InvalidKind"))
					Expect(kindErr.ErrorBody()).To(ContainSubstring("invalid kind for a WorkspaceKind"))
				},
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				errs := ValidateWorkspaceKindGVK(tc.apiVersion, tc.kind)
				tc.validate(errs)
			})
		}
	})

	Describe("ValidateKubernetesNamespaceName", func() {
		type testCase struct {
			description string
			name        string
			shouldPass  bool
		}

		testCases := []testCase{}

		for _, name := range validDNS1123LabelNames {
			testCases = append(testCases, testCase{
				description: "should accept valid namespace names",
				name:        name,
				shouldPass:  true,
			})
		}

		for _, name := range invalidDNS1123LabelNames {
			testCases = append(testCases, testCase{
				description: "should reject invalid namespace names",
				name:        name,
				shouldPass:  false,
			})
		}

		const fieldName = "namespace"
		for _, tc := range testCases {
			It(tc.description+" - "+tc.name, func() {
				path := field.NewPath(fieldName)
				errs := ValidateKubernetesNamespaceName(path, tc.name)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "namespace name %q should be valid", tc.name)
				} else {
					Expect(errs).To(HaveLen(1), "namespace name %q should return exactly one error", tc.name)
					if tc.name == "" {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired), "namespace name %q should return Required error type for empty string", tc.name)
					} else {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid), "namespace name %q should return Invalid error type", tc.name)
						Expect(errs[0].BadValue).To(Equal(tc.name), "namespace name %q error BadValue should match input", tc.name)
					}
					Expect(errs[0].Field).To(Equal(fieldName), "namespace name %q error should be on %q field", tc.name, fieldName)
				}
			})
		}
	})

	Describe("ValidateKubernetesServicesName", func() {
		type testCase struct {
			description string
			name        string
			shouldPass  bool
		}

		testCases := []testCase{}

		for _, name := range validDNS1123LabelNames {
			testCases = append(testCases, testCase{
				description: "should accept valid service names",
				name:        name,
				shouldPass:  true,
			})
		}

		for _, name := range invalidDNS1123LabelNames {
			testCases = append(testCases, testCase{
				description: "should reject invalid service names",
				name:        name,
				shouldPass:  false,
			})
		}

		const fieldName = "service"
		for _, tc := range testCases {
			It(tc.description+" - "+tc.name, func() {
				path := field.NewPath(fieldName)
				errs := ValidateKubernetesServicesName(path, tc.name)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "service name %q should be valid", tc.name)
				} else {
					Expect(errs).To(HaveLen(1), "service name %q should return exactly one error", tc.name)
					if tc.name == "" {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired), "service name %q should return Required error type for empty string", tc.name)
					} else {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid), "service name %q should return Invalid error type", tc.name)
						Expect(errs[0].BadValue).To(Equal(tc.name), "service name %q error BadValue should match input", tc.name)
					}
					Expect(errs[0].Field).To(Equal(fieldName), "service name %q error should be on %q field", tc.name, fieldName)
				}
			})
		}
	})

	Describe("ValidateKubernetesSecretName", func() {
		type testCase struct {
			description string
			name        string
			shouldPass  bool
		}

		testCases := []testCase{}

		for _, name := range validDNS1123SubdomainNames {
			testCases = append(testCases, testCase{
				description: "should accept valid secret names",
				name:        name,
				shouldPass:  true,
			})
		}

		for _, name := range invalidDNS1123SubdomainNames {
			testCases = append(testCases, testCase{
				description: "should reject invalid secret names",
				name:        name,
				shouldPass:  false,
			})
		}

		const fieldName = "secret"
		for _, tc := range testCases {
			It(tc.description+" - "+tc.name, func() {
				path := field.NewPath(fieldName)
				errs := ValidateKubernetesSecretName(path, tc.name)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "secret name %q should be valid", tc.name)
				} else {
					Expect(errs).To(HaveLen(1), "secret name %q should return exactly one error", tc.name)
					if tc.name == "" {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired), "secret name %q should return Required error type for empty string", tc.name)
					} else {
						Expect(errs[0].Type).To(Equal(field.ErrorTypeInvalid), "secret name %q should return Invalid error type", tc.name)
						Expect(errs[0].BadValue).To(Equal(tc.name), "secret name %q error BadValue should match input", tc.name)
					}
					Expect(errs[0].Field).To(Equal(fieldName), "secret name %q error should be on %q field", tc.name, fieldName)
				}
			})
		}
	})

	Describe("ValidateKubernetesLabels", func() {
		var validLabelValues = []string{
			"",                       // empty value is allowed
			"my-app",                 // simple lowercase value with dash
			"value-with-dashes",      // dashes are allowed in values
			"value_with_underscores", // underscores are allowed in values
			"value.with.dots",        // dots are allowed in values
			"UPPERCASE",              // uppercase is allowed in values
			"123numeric",             // can start with number
			"mixedCase123",           // mixed case and numbers
			"1.0.0",                  // version-like format with dots
		}

		var invalidLabelValues = []string{
			"value\nwith\nnewlines", // newlines not allowed in label values
			"value with spaces",     // spaces not allowed in label values
			"value/with/slashes",    // slashes not allowed in label values
			"value\twith\ttabs",     // tabs not allowed in label values
		}

		const validKey = "valid-key"
		const validValue = "valid-value"

		type testCase struct {
			description string
			labels      map[string]string
			shouldPass  bool
		}

		testCases := []testCase{}

		testCases = append(testCases, testCase{
			description: "should accept empty labels map",
			labels:      map[string]string{},
			shouldPass:  true,
		})

		for _, key := range validLabelAnnotationKeys {
			testCases = append(testCases, testCase{
				description: "should accept valid label keys",
				labels:      map[string]string{key: validValue},
				shouldPass:  true,
			})
		}

		for _, value := range validLabelValues {
			testCases = append(testCases, testCase{
				description: "should accept valid label values",
				labels:      map[string]string{validKey: value},
				shouldPass:  true,
			})
		}

		for _, key := range invalidLabelAnnotationKeys {
			testCases = append(testCases, testCase{
				description: "should reject invalid label keys",
				labels:      map[string]string{key: validValue},
				shouldPass:  false,
			})
		}

		for _, value := range invalidLabelValues {
			testCases = append(testCases, testCase{
				description: "should reject invalid label values",
				labels:      map[string]string{validKey: value},
				shouldPass:  false,
			})
		}

		const fieldName = "labels"
		for _, tc := range testCases {
			It(tc.description, func() {
				path := field.NewPath(fieldName)
				errs := ValidateKubernetesLabels(path, tc.labels)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "labels %v should be valid", tc.labels)
				} else {
					Expect(errs).NotTo(BeEmpty(), "labels %v should be invalid", tc.labels)
					for i := range errs {
						Expect(errs[i].Type).To(Equal(field.ErrorTypeInvalid), "labels %v error[%d] should be Invalid type", tc.labels, i)
						Expect(errs[i].Field).To(HavePrefix(fieldName), "labels %v error[%d] field should start with %q", tc.labels, i, fieldName)
					}
				}
			})
		}
	})

	Describe("ValidateKubernetesAnnotations", func() {
		var validAnnotationValues = []string{
			"",                                // empty value is allowed
			"my-app",                          // simple lowercase value
			"value-with-dashes",               // dashes are allowed
			"value_with_underscores",          // underscores are allowed
			"value.with.dots",                 // dots are allowed
			"UPPERCASE",                       // uppercase is allowed
			"123numeric",                      // can start with number
			"value with spaces",               // spaces ARE allowed in annotation values (unlike labels)
			"value\nwith\nnewlines",           // newlines ARE allowed in annotation values (unlike labels)
			"value/with/slashes",              // slashes ARE allowed in annotation values (unlike labels)
			"value\twith\ttabs",               // tabs ARE allowed in annotation values (unlike labels)
			"JSON-like: {\"key\": \"value\"}", // complex structured data is allowed
		}

		// NOTE: There are no invalid annotation values worth testing individually.
		// Annotations are extremely permissive - they allow almost any character including
		// spaces, newlines, tabs, slashes, and special characters. The only restriction
		// is that the total size of all annotations on an object cannot exceed ~256KB
		// (262135 bytes).

		const validKey = "valid-key"
		const validValue = "valid-value"

		type testCase struct {
			description string
			annotations map[string]string
			shouldPass  bool
		}

		testCases := []testCase{}

		testCases = append(testCases, testCase{
			description: "should accept empty annotations map",
			annotations: map[string]string{},
			shouldPass:  true,
		})

		for _, key := range validLabelAnnotationKeys {
			testCases = append(testCases, testCase{
				description: "should accept valid annotation keys",
				annotations: map[string]string{key: validValue},
				shouldPass:  true,
			})
		}

		for _, value := range validAnnotationValues {
			testCases = append(testCases, testCase{
				description: "should accept valid annotation values",
				annotations: map[string]string{validKey: value},
				shouldPass:  true,
			})
		}

		for _, key := range invalidLabelAnnotationKeys {
			testCases = append(testCases, testCase{
				description: "should reject invalid annotation keys",
				annotations: map[string]string{key: validValue},
				shouldPass:  false,
			})
		}

		const fieldName = "annotations"
		for _, tc := range testCases {
			It(tc.description, func() {
				path := field.NewPath(fieldName)
				errs := ValidateKubernetesAnnotations(path, tc.annotations)
				if tc.shouldPass {
					Expect(errs).To(BeEmpty(), "annotations %v should be valid", tc.annotations)
				} else {
					Expect(errs).NotTo(BeEmpty(), "annotations %v should be invalid", tc.annotations)
					for i := range errs {
						Expect(errs[i].Type).To(Equal(field.ErrorTypeInvalid), "annotations %v error[%d] should be Invalid type", tc.annotations, i)
						Expect(errs[i].Field).To(HavePrefix(fieldName), "annotations %v error[%d] field should start with %q", tc.annotations, i, fieldName)
					}
				}
			})
		}
	})

	Describe("StatusCausesFromAPIStatus", func() {
		// Test message constants
		const (
			field1RequiredMsg             = "field1 is required"
			field2InvalidMsg              = "field2 is invalid"
			workspaceKindInUseMsg         = "WorkspaceKind is used by 5 workspace(s)"
			operationCannotBeFulfilledMsg = "Operation cannot be fulfilled"
		)

		// Helper validation functions for common test cases
		validateNil := func(causes []metav1.StatusCause) {
			Expect(causes).To(BeNil())
		}
		validateEmpty := func(causes []metav1.StatusCause) {
			Expect(causes).To(BeEmpty())
		}

		type testCase struct {
			description string
			err         error
			validate    func([]metav1.StatusCause)
		}

		testCases := []testCase{
			{
				description: "should extract causes from Invalid error",
				err: apierrors.NewInvalid(
					schema.GroupKind{Group: "test", Kind: "Test"},
					"test-name",
					field.ErrorList{
						field.Required(field.NewPath("spec", "field1"), field1RequiredMsg),
						field.Invalid(field.NewPath("spec", "field2"), "value", field2InvalidMsg),
					},
				),
				validate: func(causes []metav1.StatusCause) {
					Expect(causes).To(HaveLen(2))
					Expect(causes[0].Field).To(Equal("spec.field1"))
					Expect(causes[0].Message).To(ContainSubstring(field1RequiredMsg))
					Expect(causes[1].Field).To(Equal("spec.field2"))
					Expect(causes[1].Message).To(ContainSubstring(field2InvalidMsg))
				},
			},
			{
				description: "should extract causes from Conflict error (NewApplyConflict)",
				err: apierrors.NewApplyConflict(
					[]metav1.StatusCause{
						{
							Type:    metav1.CauseTypeFieldValueInvalid,
							Message: workspaceKindInUseMsg,
						},
					},
					operationCannotBeFulfilledMsg,
				),
				validate: func(causes []metav1.StatusCause) {
					Expect(causes).To(HaveLen(1))
					Expect(causes[0].Message).To(Equal(workspaceKindInUseMsg))
				},
			},
			{
				description: "should extract causes from Conflict error created like webhook (StatusError)",
				err: &apierrors.StatusError{
					ErrStatus: metav1.Status{
						Status: metav1.StatusFailure,
						Code:   http.StatusConflict,
						Reason: metav1.StatusReasonConflict,
						Details: &metav1.StatusDetails{
							Group: "kubeflow.org",
							Kind:  "WorkspaceKind",
							Name:  "test-workspacekind",
							Causes: []metav1.StatusCause{
								{
									Message: workspaceKindInUseMsg,
								},
							},
						},
						Message: "Operation cannot be fulfilled on WorkspaceKind \"test-workspacekind\"",
					},
				},
				validate: func(causes []metav1.StatusCause) {
					Expect(causes).To(HaveLen(1))
					Expect(causes[0].Message).To(Equal(workspaceKindInUseMsg))
				},
			},
			{
				description: "should return empty for Conflict error without causes",
				err: apierrors.NewConflict(
					schema.GroupResource{Group: "test", Resource: "tests"},
					"test-name",
					nil,
				),
				validate: validateEmpty,
			},
			{
				description: "should return nil for non-APIStatus error",
				err:         &testError{message: "not an APIStatus error"},
				validate:    validateNil,
			},
			{
				description: "should return nil for APIStatus error with different reason",
				err: apierrors.NewNotFound(
					schema.GroupResource{Group: "test", Resource: "tests"},
					"test-name",
				),
				validate: validateNil,
			},
			{
				description: "should handle error with nil Details gracefully",
				err: &apierrors.StatusError{
					ErrStatus: metav1.Status{
						Status:  metav1.StatusFailure,
						Code:    422,
						Reason:  metav1.StatusReasonInvalid,
						Details: nil,
					},
				},
				validate: validateNil,
			},
			{
				description: "should handle error with empty Causes",
				err: &apierrors.StatusError{
					ErrStatus: metav1.Status{
						Status: metav1.StatusFailure,
						Code:   422,
						Reason: metav1.StatusReasonInvalid,
						Details: &metav1.StatusDetails{
							Causes: []metav1.StatusCause{},
						},
					},
				},
				validate: validateEmpty,
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				causes := StatusCausesFromAPIStatus(tc.err)
				tc.validate(causes)
			})
		}
	})
})
