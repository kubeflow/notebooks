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

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var _ = Describe("Error Response Functions", func() {

	// Shared constants (used across multiple Describe blocks or in BeforeEach)
	const (
		testRequestPath   = "/test"
		testRequestMethod = "GET"

		// Used in both failedValidationResponse and Error response structure
		testFieldName       = "name"
		testNameRequiredMsg = "name is required"
	)

	var (
		app *App
		w   *httptest.ResponseRecorder
		r   *http.Request
	)

	BeforeEach(func() {
		app = &App{}
		w = httptest.NewRecorder()
		r = httptest.NewRequest(testRequestMethod, testRequestPath, http.NoBody)
	})

	Describe("conflictResponse", func() {
		const (
			httpStatusCodeConflict = http.StatusConflict

			testGroupResourceGroup    = "test"
			testGroupResourceResource = "tests"
			testResourceName          = "test-name"
			testConflictMsg           = "WorkspaceKind is used by 5 workspace(s)"
		)

		var httpStatusCodeConflictStr = strconv.Itoa(http.StatusConflict)

		type testCase struct {
			description string
			err         error
			k8sCauses   []metav1.StatusCause
		}

		conflictErr := apierrors.NewConflict(
			schema.GroupResource{Group: testGroupResourceGroup, Resource: testGroupResourceResource},
			testResourceName,
			nil,
		)

		testCases := []testCase{
			{
				description: "should return 409 with k8s causes",
				err:         conflictErr,
				k8sCauses:   []metav1.StatusCause{{Type: metav1.CauseTypeFieldValueInvalid, Message: testConflictMsg}},
			},
			{
				description: "should return 409 with error message when no k8s causes",
				err:         conflictErr,
				k8sCauses:   nil,
			},
			{
				description: "should return 409 with empty conflict causes array",
				err:         conflictErr,
				k8sCauses:   []metav1.StatusCause{},
			},
		}

		buildExpectedConflictResponse := func(err error, k8sCauses []metav1.StatusCause, codeStr string) ErrorResponse {
			expectedConflictCauses := make([]ConflictError, len(k8sCauses))
			for i, cause := range k8sCauses {
				expectedConflictCauses[i] = ConflictError{
					Origin:  OriginKubernetes,
					Message: cause.Message,
				}
			}

			// Determine message: if we have k8s causes, use generic message; otherwise use error message
			var expectedMessage string
			if len(k8sCauses) > 0 {
				expectedMessage = errMsgKubernetesConflict
			} else {
				expectedMessage = err.Error()
			}

			// Empty slices become nil after JSON unmarshaling
			var expectedConflictCausesForComparison []ConflictError
			if len(expectedConflictCauses) > 0 {
				expectedConflictCausesForComparison = expectedConflictCauses
			} else {
				expectedConflictCausesForComparison = nil
			}

			return ErrorResponse{
				Code:    codeStr,
				Message: expectedMessage,
				Cause: &ErrorCause{
					ConflictCauses: expectedConflictCausesForComparison,
				},
			}
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				app.conflictResponse(w, r, tc.err, tc.k8sCauses)

				Expect(w.Code).To(Equal(httpStatusCodeConflict))

				var envelope ErrorEnvelope
				unmarshalErr := json.Unmarshal(w.Body.Bytes(), &envelope)
				Expect(unmarshalErr).NotTo(HaveOccurred())
				Expect(envelope.Error).NotTo(BeNil())

				expectedErrorResponse := buildExpectedConflictResponse(tc.err, tc.k8sCauses, httpStatusCodeConflictStr)
				Expect(envelope.Error.ErrorResponse).To(Equal(expectedErrorResponse))
			})
		}
	})

	Describe("failedValidationResponse", func() {
		const (
			httpStatusCodeUnprocessableEntity = http.StatusUnprocessableEntity

			testFieldKind      = "kind"
			testFieldSpecName  = "spec.name"
			testFieldSpecKind  = "spec.kind"
			testInvalidKind    = "invalid-kind"
			testKindInvalidMsg = "kind is invalid"
		)

		var httpStatusCodeUnprocessableEntityStr = strconv.Itoa(http.StatusUnprocessableEntity)

		type testCase struct {
			description string
			msg         string
			valErrs     field.ErrorList
			k8sCauses   []metav1.StatusCause
		}

		buildExpectedValidationResponse := func(msg string, valErrs field.ErrorList, k8sCauses []metav1.StatusCause, codeStr string) ErrorResponse {
			valErrsConverted := make([]ValidationError, len(valErrs))
			for i, err := range valErrs {
				valErrsConverted[i] = ValidationError{
					Origin:  OriginInternal,
					Type:    err.Type,
					Field:   err.Field,
					Message: err.ErrorBody(),
				}
			}

			k8sCausesConverted := make([]ValidationError, len(k8sCauses))
			for i, cause := range k8sCauses {
				k8sCausesConverted[i] = ValidationError{
					Origin:  OriginKubernetes,
					Type:    field.ErrorType(cause.Type),
					Field:   cause.Field,
					Message: cause.Message,
				}
			}

			expectedValidationErrors := make([]ValidationError, len(valErrsConverted)+len(k8sCausesConverted))
			copy(expectedValidationErrors, valErrsConverted)
			copy(expectedValidationErrors[len(valErrsConverted):], k8sCausesConverted)

			var expectedValidationErrorsForComparison []ValidationError
			if len(expectedValidationErrors) > 0 {
				expectedValidationErrorsForComparison = expectedValidationErrors
			} else {
				expectedValidationErrorsForComparison = nil
			}

			return ErrorResponse{
				Code:    codeStr,
				Message: msg,
				Cause: &ErrorCause{
					ValidationErrors: expectedValidationErrorsForComparison,
				},
			}
		}

		testCases := []testCase{
			{
				description: "should return 422 with internal validation errors",
				msg:         errMsgRequestBodyInvalid,
				valErrs: field.ErrorList{
					field.Required(field.NewPath(testFieldName), ""),
					field.Invalid(field.NewPath(testFieldKind), testInvalidKind, testKindInvalidMsg),
				},
				k8sCauses: nil,
			},
			{
				description: "should return 422 with k8s validation errors",
				msg:         errMsgKubernetesValidation,
				valErrs:     nil,
				k8sCauses: []metav1.StatusCause{
					{
						Type:    metav1.CauseTypeFieldValueRequired,
						Field:   testFieldSpecName,
						Message: testNameRequiredMsg,
					},
					{
						Type:    metav1.CauseTypeFieldValueInvalid,
						Field:   testFieldSpecKind,
						Message: testKindInvalidMsg,
					},
				},
			},
			{
				description: "should return 422 with both internal and k8s validation errors",
				msg:         errMsgRequestBodyInvalid,
				valErrs: field.ErrorList{
					field.Required(field.NewPath(testFieldName), ""),
				},
				k8sCauses: []metav1.StatusCause{
					{
						Type:    metav1.CauseTypeFieldValueInvalid,
						Field:   testFieldSpecKind,
						Message: testKindInvalidMsg,
					},
				},
			},
			{
				description: "should return 422 with empty validation errors",
				msg:         errMsgRequestBodyInvalid,
				valErrs:     nil,
				k8sCauses:   nil,
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				app.failedValidationResponse(w, r, tc.msg, tc.valErrs, tc.k8sCauses)

				Expect(w.Code).To(Equal(httpStatusCodeUnprocessableEntity))

				var envelope ErrorEnvelope
				err := json.Unmarshal(w.Body.Bytes(), &envelope)
				Expect(err).NotTo(HaveOccurred())
				Expect(envelope.Error).NotTo(BeNil())

				expectedErrorResponse := buildExpectedValidationResponse(tc.msg, tc.valErrs, tc.k8sCauses, httpStatusCodeUnprocessableEntityStr)
				Expect(envelope.Error.ErrorResponse).To(Equal(expectedErrorResponse))
			})
		}
	})
})
