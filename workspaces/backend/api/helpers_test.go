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
	"encoding/json/jsontext"
	jsonv2 "encoding/json/v2"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"strings"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var _ = Describe("Helper Functions", func() {

	Describe("IsSemanticError", func() {
		app := &App{}

		DescribeTable("should correctly identify SemanticError",
			func(err error, expected bool) {
				Expect(app.IsSemanticError(err)).To(Equal(expected))
			},
			Entry("direct SemanticError",
				&jsonv2.SemanticError{JSONPointer: "/data/paused", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[bool]()}, true),
			Entry("wrapped SemanticError",
				fmt.Errorf("some wrapper: %w", &jsonv2.SemanticError{JSONPointer: "/data/paused", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[bool]()}), true),
			Entry("SemanticError wrapping ErrUnknownName (rejected unknown member)",
				&jsonv2.SemanticError{JSONPointer: "/data/extra", Err: jsonv2.ErrUnknownName}, true),
			Entry("generic error",
				fmt.Errorf("some generic error"), false),
			Entry("MaxBytesError",
				&http.MaxBytesError{Limit: 1024}, false),
		)
	})

	Describe("DecodeJSON", func() {
		type testTarget struct {
			Name   string `json:"name"`
			Paused bool   `json:"paused"`
		}

		type testCase struct {
			description      string
			body             string
			maxBytes         int64
			errorTypeCheckFn func(*App, error) bool
			errorSubstring   string
		}

		testCases := []testCase{
			{
				description: "should return nil for valid JSON",
				body:        `{"name": "test", "paused": true}`,
			},
			{
				description:      "should return a SemanticError for type mismatches",
				body:             `{"name": "test", "paused": "not-a-bool"}`,
				errorTypeCheckFn: (*App).IsSemanticError,
			},
			{
				description:      "should return a MaxBytesError when the body exceeds the size limit",
				body:             `{"name": "test", "paused": true}`,
				maxBytes:         5,
				errorTypeCheckFn: (*App).IsMaxBytesError,
			},
			{
				description:    "should return an error for an empty body",
				body:           "",
				errorSubstring: "request body was empty",
			},
			{
				description:    "should return an error for a whitespace-only body",
				body:           " \t\r\n ",
				errorSubstring: "request body was empty",
			},
			{
				description:    "should return a decoding error (not an empty-body error) for a truncated body",
				body:           `{"name": "test", "paused":`,
				errorSubstring: "error decoding JSON",
			},
			{
				description:    "should return a wrapped error for malformed JSON",
				body:           `{not valid json}`,
				errorSubstring: "error decoding JSON",
			},
			{
				description:      "should return a SemanticError for unknown JSON fields",
				body:             `{"name": "test", "paused": true, "extraField": "surprise"}`,
				errorTypeCheckFn: (*App).IsSemanticError,
			},
			{
				description:      "should treat a case-mismatched field name as an unknown member",
				body:             `{"name": "test", "Paused": true}`,
				errorTypeCheckFn: (*App).IsSemanticError,
			},
			{
				description:    "should reject duplicate JSON object member names",
				body:           `{"name": "test", "paused": true, "paused": false}`,
				errorSubstring: "error decoding JSON",
			},
			{
				description:    "should reject invalid UTF-8 in a JSON string",
				body:           "{\"name\": \"\xff\xfe\", \"paused\": true}",
				errorSubstring: "error decoding JSON",
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				app := &App{}
				r := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(tc.body))
				if tc.maxBytes > 0 {
					r.Body = http.MaxBytesReader(nil, r.Body, tc.maxBytes)
				}

				var target testTarget
				err := app.DecodeJSON(r, &target)

				if tc.errorTypeCheckFn == nil && tc.errorSubstring == "" {
					Expect(err).NotTo(HaveOccurred())
					return
				}

				Expect(err).To(HaveOccurred())
				if tc.errorTypeCheckFn != nil {
					Expect(tc.errorTypeCheckFn(app, err)).To(BeTrue())
				}
				if tc.errorSubstring != "" {
					Expect(err.Error()).To(ContainSubstring(tc.errorSubstring))
				}
			})
		}
	})

	Describe("DecodeRequestBody", func() {
		type testTarget struct {
			Data struct {
				Name   string `json:"name"`
				Paused bool   `json:"paused"`
				Port   int32  `json:"port"`
			} `json:"data"`
		}

		type testCase struct {
			description      string
			body             string
			maxBytes         int64
			expectedSuccess  bool
			expectedStatus   int
			expectedResponse *ErrorEnvelope
		}

		testCases := []testCase{
			{
				description:     "should decode a valid body and write no response",
				body:            `{"data": {"name": "test", "paused": true}}`,
				expectedSuccess: true,
				expectedStatus:  http.StatusOK,
			},
			{
				description:    "should write a 413 when the body exceeds the size limit",
				body:           `{"data": {"name": "test", "paused": true}}`,
				maxBytes:       5,
				expectedStatus: http.StatusRequestEntityTooLarge,
				expectedResponse: &ErrorEnvelope{Error: &HTTPError{ErrorResponse: ErrorResponse{
					Code:    strconv.Itoa(http.StatusRequestEntityTooLarge),
					Message: "http: request body too large",
				}}},
			},
			{
				description:    "should write a 422 with a field-level error for a type mismatch",
				body:           `{"data": {"name": "test", "paused": "yes"}}`,
				expectedStatus: http.StatusUnprocessableEntity,
				expectedResponse: &ErrorEnvelope{Error: &HTTPError{ErrorResponse: ErrorResponse{
					Code:    strconv.Itoa(http.StatusUnprocessableEntity),
					Message: errMsgRequestBodyInvalid,
					Cause: &ErrorCause{ValidationErrors: []ValidationError{{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeTypeInvalid,
						Field:   "data.paused",
						Message: `Invalid value: "string": got JSON string, but field requires boolean`,
					}}},
				}}},
			},
			{
				description:    "should write a 422 with the underlying error for a value the field's type rejects",
				body:           `{"data": {"name": "test", "port": 99999999999}}`,
				expectedStatus: http.StatusUnprocessableEntity,
				expectedResponse: &ErrorEnvelope{Error: &HTTPError{ErrorResponse: ErrorResponse{
					Code:    strconv.Itoa(http.StatusUnprocessableEntity),
					Message: errMsgRequestBodyInvalid,
					Cause: &ErrorCause{ValidationErrors: []ValidationError{{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeInvalid,
						Field:   "data.port",
						Message: `Invalid value: "number": value out of range`,
					}}},
				}}},
			},
			{
				description:    "should write a 422 with a field-level error for an unknown field",
				body:           `{"data": {"name": "test", "bogus": true}}`,
				expectedStatus: http.StatusUnprocessableEntity,
				expectedResponse: &ErrorEnvelope{Error: &HTTPError{ErrorResponse: ErrorResponse{
					Code:    strconv.Itoa(http.StatusUnprocessableEntity),
					Message: errMsgRequestBodyInvalid,
					Cause: &ErrorCause{ValidationErrors: []ValidationError{{
						Origin:  OriginInternal,
						Type:    field.ErrorTypeInvalid,
						Field:   "data.bogus",
						Message: "Invalid value: null: unknown field",
					}}},
				}}},
			},
			{
				description:    "should write a 400 for an empty body",
				body:           "",
				expectedStatus: http.StatusBadRequest,
				expectedResponse: &ErrorEnvelope{Error: &HTTPError{ErrorResponse: ErrorResponse{
					Code:    strconv.Itoa(http.StatusBadRequest),
					Message: "error decoding request body: request body was empty",
				}}},
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				app := &App{}
				w := httptest.NewRecorder()
				r := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(tc.body))
				if tc.maxBytes > 0 {
					r.Body = http.MaxBytesReader(nil, r.Body, tc.maxBytes)
				}

				var target testTarget
				Expect(app.DecodeRequestBody(w, r, &target)).To(Equal(tc.expectedSuccess))
				Expect(w.Code).To(Equal(tc.expectedStatus), w.Body.String())

				if tc.expectedResponse == nil {
					Expect(w.Body.Len()).To(BeZero())
					return
				}
				var response ErrorEnvelope
				Expect(json.Unmarshal(w.Body.Bytes(), &response)).To(Succeed())
				Expect(response).To(BeComparableTo(*tc.expectedResponse))
			})
		}
	})

})
