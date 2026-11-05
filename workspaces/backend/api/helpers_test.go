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
	"encoding/json/jsontext"
	jsonv2 "encoding/json/v2"
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

	Describe("FieldErrorsFromSemanticError", func() {

		type testCase struct {
			description string
			err         error
			expected    field.ErrorList
		}

		// root mirrors the shape of a typical request envelope: a top-level "data" struct
		// field containing scalars, a slice, and a map.
		type fieldErrorsFixtureData struct {
			Paused      bool              `json:"paused"`
			Name        string            `json:"name"`
			AccessModes []string          `json:"accessModes"`
			Contents    map[string]string `json:"contents"`
			PodTemplate struct {
				Options struct {
					ImageConfig string `json:"imageConfig"`
				} `json:"options"`
			} `json:"podTemplate"`
		}
		type fieldErrorsFixtureEnvelope struct {
			Data fieldErrorsFixtureData `json:"data"`
		}
		root := reflect.TypeFor[fieldErrorsFixtureEnvelope]()

		testCases := []testCase{
			{
				description: "should return nil for a non-SemanticError",
				err:         fmt.Errorf("some generic error"),
				expected:    nil,
			},
			{
				description: "should convert string-for-bool type mismatch",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/paused", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[bool]()},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), jsonTypeString, "got JSON string, but field requires boolean"),
				},
			},
			{
				description: "should convert number-for-string type mismatch",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/name", JSONKind: jsontext.KindNumber, GoType: reflect.TypeFor[string]()},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("name"), jsonTypeNumber, "got JSON number, but field requires string"),
				},
			},
			{
				description: "should convert string-for-array type mismatch",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/accessModes", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[[]string]()},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("accessModes"), jsonTypeString, "got JSON string, but field requires array"),
				},
			},
			{
				description: "should convert string-for-object (map) type mismatch",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/contents", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[map[string]string]()},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("contents"), jsonTypeString, "got JSON string, but field requires object"),
				},
			},
			{
				description: "should handle an empty JSON Pointer (top-level type mismatch)",
				err:         &jsonv2.SemanticError{JSONPointer: "", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[fieldErrorsFixtureEnvelope]()},
				expected: field.ErrorList{
					{Type: field.ErrorTypeTypeInvalid, BadValue: jsonTypeString, Detail: "got JSON string, but field requires object"},
				},
			},
			{
				description: "should dereference a pointer GoType for the expected-type message",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/paused", JSONKind: jsontext.KindNumber, GoType: reflect.TypeFor[*bool]()},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), jsonTypeNumber, "got JSON number, but field requires boolean"),
				},
			},
			{
				description: "should handle deeply nested field paths",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/podTemplate/options/imageConfig", JSONKind: jsontext.KindTrue, GoType: reflect.TypeFor[string]()},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("podTemplate").Child("options").Child("imageConfig"), jsonTypeBoolean, "got JSON boolean, but field requires string"),
				},
			},
			{
				description: "should convert a rejected unknown member into an 'unknown field' error",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/bogus", Err: jsonv2.ErrUnknownName},
				expected: field.ErrorList{
					field.Invalid(field.NewPath("data").Child("bogus"), nil, "unknown field"),
				},
			},
			{
				description: "should convert a case-mismatched field name into an 'unknown field' error",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/Paused", Err: jsonv2.ErrUnknownName},
				expected: field.ErrorList{
					field.Invalid(field.NewPath("data").Child("Paused"), nil, "unknown field"),
				},
			},
			{
				description: "should report an unknown member nested under a struct field using its JSON Pointer",
				err:         &jsonv2.SemanticError{JSONPointer: "/data/podTemplate/options/extra", Err: jsonv2.ErrUnknownName},
				expected: field.ErrorList{
					field.Invalid(field.NewPath("data").Child("podTemplate").Child("options").Child("extra"), nil, "unknown field"),
				},
			},
		}

		for _, tc := range testCases {
			It(tc.description, func() {
				result := FieldErrorsFromSemanticError(tc.err, root)
				if tc.expected == nil {
					Expect(result).To(BeNil())
				} else {
					Expect(result).To(ConsistOf(tc.expected))
				}
			})
		}
	})

	Describe("JSONPointerToFieldPath", func() {
		// fixtures mirror a request body with a struct field, a nested struct, a slice of
		// structs, and a map of structs, so each walker branch (struct/slice/map) is exercised.
		type pathFixtureVolume struct {
			PvcName string `json:"pvcName"`
		}
		type pathFixtureContent struct {
			Base64 int `json:"base64"`
		}
		type pathFixturePodTemplate struct {
			Volumes []pathFixtureVolume `json:"volumes"`
		}
		type pathFixtureData struct {
			Paused      bool                          `json:"paused"`
			PodTemplate pathFixturePodTemplate        `json:"podTemplate"`
			Contents    map[string]pathFixtureContent `json:"contents"`
		}
		root := reflect.TypeFor[pathFixtureData]()

		DescribeTable("should resolve JSON Pointer tokens using the destination Go type",
			func(pointer jsontext.Pointer, expected string) {
				path := JSONPointerToFieldPath(root, pointer)
				if expected == "" {
					Expect(path).To(BeNil())
				} else {
					Expect(path.String()).To(Equal(expected))
				}
			},
			Entry("empty pointer (root value)", jsontext.Pointer(""), ""),
			Entry("top-level struct field", jsontext.Pointer("/paused"), "paused"),
			Entry("nested struct field", jsontext.Pointer("/podTemplate/volumes"), "podTemplate.volumes"),
			Entry("slice index", jsontext.Pointer("/podTemplate/volumes/1/pvcName"), "podTemplate.volumes[1].pvcName"),
			Entry("map key", jsontext.Pointer("/contents/foo/base64"), "contents[foo].base64"),
			Entry("dotted map key is not confused with nested fields", jsontext.Pointer("/contents/tls.crt/base64"), "contents[tls.crt].base64"),
			Entry("numeric map key is not confused with a slice index", jsontext.Pointer("/contents/1/base64"), "contents[1].base64"),
			Entry("JSON Pointer escaping (~1 for '/') is decoded by Tokens()", jsontext.Pointer("/contents/a~1b/base64"), "contents[a/b].base64"),
			Entry("unresolvable token falls back to a child field (defensive)", jsontext.Pointer("/doesNotExist"), "doesNotExist"),
		)
	})

	Describe("jsonKindToTypeName", func() {
		DescribeTable("should map jsontext.Kind to user-friendly JSON type names",
			func(kind jsontext.Kind, expected string) {
				Expect(jsonKindToTypeName(kind)).To(Equal(expected))
			},
			Entry("true", jsontext.KindTrue, jsonTypeBoolean),
			Entry("false", jsontext.KindFalse, jsonTypeBoolean),
			Entry("number", jsontext.KindNumber, jsonTypeNumber),
			Entry("string", jsontext.KindString, jsonTypeString),
			Entry("array", jsontext.KindBeginArray, jsonTypeArray),
			Entry("object", jsontext.KindBeginObject, jsonTypeObject),
			Entry("null", jsontext.KindNull, jsonTypeNull),
			Entry("invalid/unknown", jsontext.KindInvalid, jsonTypeUnknown),
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
				// encoding/json/v2 reports rejected unknown members as a *jsonv2.SemanticError
				// wrapping jsonv2.ErrUnknownName, which IsSemanticError now treats as a semantic
				// error (see its doc comment), so callers can report it as a field-level error via
				// FieldErrorsFromSemanticError instead of the generic decode error.
				description:      "should return a SemanticError for unknown JSON fields",
				body:             `{"name": "test", "paused": true, "extraField": "surprise"}`,
				errorTypeCheckFn: (*App).IsSemanticError,
			},
			{
				// encoding/json/v2 matches JSON object names to struct fields case-sensitively by
				// default (v1 matched case-insensitively), so a field sent with the wrong case is
				// rejected the same way as any other unknown member.
				description:      "should treat a case-mismatched field name as an unknown member",
				body:             `{"name": "test", "Paused": true}`,
				errorTypeCheckFn: (*App).IsSemanticError,
			},
			{
				// encoding/json/v2 rejects duplicate object member names by default (v1 silently
				// kept the last one); this is an intentional, pre-GA behavior change.
				description:    "should reject duplicate JSON object member names",
				body:           `{"name": "test", "paused": true, "paused": false}`,
				errorSubstring: "error decoding JSON",
			},
			{
				// encoding/json/v2 rejects invalid UTF-8 in JSON strings by default (v1 silently
				// replaced invalid bytes with U+FFFD); this is an intentional, pre-GA behavior change.
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
