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
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var _ = Describe("Helper Functions", func() {

	Describe("IsUnmarshalTypeError", func() {
		app := &App{}

		DescribeTable("should correctly identify UnmarshalTypeError",
			func(err error, expected bool) {
				Expect(app.IsUnmarshalTypeError(err)).To(Equal(expected))
			},
			Entry("direct UnmarshalTypeError",
				&json.UnmarshalTypeError{Value: "string", Type: reflect.TypeFor[bool](), Field: "data.paused"}, true),
			Entry("wrapped UnmarshalTypeError",
				fmt.Errorf("some wrapper: %w", &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeFor[bool](), Field: "data.paused"}), true),
			Entry("generic error",
				fmt.Errorf("some generic error"), false),
			Entry("MaxBytesError",
				&http.MaxBytesError{Limit: 1024}, false),
		)
	})

	Describe("FieldErrorsFromUnmarshalTypeError", func() {

		type testCase struct {
			description string
			err         error
			expected    field.ErrorList
		}

		testCases := []testCase{
			{
				description: "should return nil for a non-UnmarshalTypeError",
				err:         fmt.Errorf("some generic error"),
				expected:    nil,
			},
			{
				description: "should convert string-for-bool type mismatch",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeFor[bool](), Field: "data.paused"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), "string", "got JSON string, but field requires boolean"),
				},
			},
			{
				description: "should convert number-for-string type mismatch",
				err:         &json.UnmarshalTypeError{Value: "number", Type: reflect.TypeFor[string](), Field: "data.name"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("name"), "number", "got JSON number, but field requires string"),
				},
			},
			{
				description: "should convert string-for-array type mismatch",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeFor[[]string](), Field: "data.accessModes"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("accessModes"), "string", "got JSON string, but field requires array"),
				},
			},
			{
				description: "should convert string-for-object type mismatch",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeFor[map[string]string](), Field: "data.contents"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("contents"), "string", "got JSON string, but field requires object"),
				},
			},
			{
				description: "should handle empty field path (top-level type mismatch)",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeFor[struct{}](), Field: ""},
				expected: field.ErrorList{
					{Type: field.ErrorTypeTypeInvalid, BadValue: "string", Detail: "got JSON string, but field requires object"},
				},
			},
			{
				description: "should handle pointer types by dereferencing",
				err:         &json.UnmarshalTypeError{Value: "number", Type: reflect.TypeFor[*bool](), Field: "data.paused"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), "number", "got JSON number, but field requires boolean"),
				},
			},
			{
				description: "should handle deeply nested field paths",
				err:         &json.UnmarshalTypeError{Value: "bool", Type: reflect.TypeFor[string](), Field: "data.podTemplate.options.imageConfig"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("podTemplate").Child("options").Child("imageConfig"), "bool", "got JSON bool, but field requires string"),
				},
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				result := FieldErrorsFromUnmarshalTypeError(tc.err)
				if tc.expected == nil {
					Expect(result).To(BeNil())
				} else {
					Expect(result).To(ConsistOf(tc.expected))
				}
			})
		}
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
				description:      "should return an UnmarshalTypeError for type mismatches",
				body:             `{"name": "test", "paused": "not-a-bool"}`,
				errorTypeCheckFn: (*App).IsUnmarshalTypeError,
			},
			{
				description:      "should return a MaxBytesError when the body exceeds the size limit",
				body:             `{"name": "test", "paused": true}`,
				maxBytes:         5,
				errorTypeCheckFn: (*App).IsMaxBytesError,
			},
			{
				description:      "should return a wrapped EOF error for an empty body",
				body:             "",
				errorTypeCheckFn: (*App).IsEOFError,
				errorSubstring:   "request body was empty",
			},
			{
				description:    "should return a wrapped error for malformed JSON",
				body:           `{not valid json}`,
				errorSubstring: "error decoding JSON",
			},
			{
				// NOTE: Go's json.Decoder returns a plain *errors.errorString for unknown fields
				// (not a typed error like *json.UnmarshalTypeError), so callers cannot use errors.As
				// to detect this case — only string matching works.
				// See: https://github.com/golang/go/blob/master/src/encoding/json/decode.go
				description:    "should return a plain error for unknown JSON fields (not a typed error)",
				body:           `{"name": "test", "paused": true, "extraField": "surprise"}`,
				errorSubstring: "json: unknown field",
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

	Describe("goTypeToJSONTypeName", func() {

		type selfRef *selfRef

		DescribeTable("should map Go types to JSON type names",
			func(goType reflect.Type, expectPanic bool, expectedName string) {
				if expectPanic {
					Expect(func() { goTypeToJSONTypeName(goType) }).To(Panic())
					return
				}
				Expect(goTypeToJSONTypeName(goType)).To(Equal(expectedName))
			},
			Entry("bool", reflect.TypeFor[bool](), false, jsonTypeBoolean),
			Entry("int", reflect.TypeFor[int](), false, jsonTypeNumber),
			Entry("int32", reflect.TypeFor[int32](), false, jsonTypeNumber),
			Entry("int64", reflect.TypeFor[int64](), false, jsonTypeNumber),
			Entry("float32", reflect.TypeFor[float32](), false, jsonTypeNumber),
			Entry("float64", reflect.TypeFor[float64](), false, jsonTypeNumber),
			Entry("uint", reflect.TypeFor[uint](), false, jsonTypeNumber),
			Entry("string", reflect.TypeFor[string](), false, jsonTypeString),
			Entry("slice", reflect.TypeFor[[]string](), false, jsonTypeArray),
			Entry("array", reflect.TypeFor[[3]int](), false, jsonTypeArray),
			Entry("map", reflect.TypeFor[map[string]string](), false, jsonTypeObject),
			Entry("struct", reflect.TypeFor[struct{}](), false, jsonTypeObject),
			Entry("pointer to bool", reflect.TypeFor[*bool](), false, jsonTypeBoolean),
			Entry("pointer to string", reflect.TypeFor[*string](), false, jsonTypeString),
			Entry("pointer to struct", reflect.TypeFor[*struct{}](), false, jsonTypeObject),
			Entry("nil type", nil, false, jsonTypeUnknown),
			Entry("unmapped kind falls back to Type.String()", reflect.TypeFor[chan int](), false, "chan int"),
			Entry("self-referential pointer type panics", reflect.TypeFor[selfRef](), true, ""),
		)
	})

})
