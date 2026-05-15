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
	"reflect"

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
				&json.UnmarshalTypeError{Value: "string", Type: reflect.TypeOf(true), Field: "data.paused"}, true),
			Entry("wrapped UnmarshalTypeError",
				fmt.Errorf("some wrapper: %w", &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeOf(true), Field: "data.paused"}), true),
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
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeOf(true), Field: "data.paused"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), "string", "got JSON string, but field requires boolean"),
				},
			},
			{
				description: "should convert number-for-string type mismatch",
				err:         &json.UnmarshalTypeError{Value: "number", Type: reflect.TypeOf(""), Field: "data.name"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("name"), "number", "got JSON number, but field requires string"),
				},
			},
			{
				description: "should convert string-for-array type mismatch",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeOf([]string{}), Field: "data.accessModes"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("accessModes"), "string", "got JSON string, but field requires array"),
				},
			},
			{
				description: "should convert string-for-object type mismatch",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeOf(map[string]string{}), Field: "data.contents"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("contents"), "string", "got JSON string, but field requires object"),
				},
			},
			{
				description: "should handle empty field path (top-level type mismatch)",
				err:         &json.UnmarshalTypeError{Value: "string", Type: reflect.TypeOf(struct{}{}), Field: ""},
				expected: field.ErrorList{
					{Type: field.ErrorTypeTypeInvalid, BadValue: "string", Detail: "got JSON string, but field requires object"},
				},
			},
			{
				description: "should handle pointer types by dereferencing",
				err:         &json.UnmarshalTypeError{Value: "number", Type: reflect.TypeOf((*bool)(nil)), Field: "data.paused"},
				expected: field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), "number", "got JSON number, but field requires boolean"),
				},
			},
			{
				description: "should handle deeply nested field paths",
				err:         &json.UnmarshalTypeError{Value: "bool", Type: reflect.TypeOf(""), Field: "data.podTemplate.options.imageConfig"},
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

	Describe("goTypeToJSONTypeName", func() {

		DescribeTable("should map Go types to JSON type names",
			func(goType reflect.Type, expectedName string) {
				Expect(goTypeToJSONTypeName(goType)).To(Equal(expectedName))
			},
			Entry("bool", reflect.TypeOf(true), "boolean"),
			Entry("int", reflect.TypeOf(0), "number"),
			Entry("int32", reflect.TypeOf(int32(0)), "number"),
			Entry("int64", reflect.TypeOf(int64(0)), "number"),
			Entry("float32", reflect.TypeOf(float32(0)), "number"),
			Entry("float64", reflect.TypeOf(float64(0)), "number"),
			Entry("uint", reflect.TypeOf(uint(0)), "number"),
			Entry("string", reflect.TypeOf(""), "string"),
			Entry("slice", reflect.TypeOf([]string{}), "array"),
			Entry("array", reflect.TypeOf([3]int{}), "array"),
			Entry("map", reflect.TypeOf(map[string]string{}), "object"),
			Entry("struct", reflect.TypeOf(struct{}{}), "object"),
			Entry("pointer to bool", reflect.TypeOf((*bool)(nil)), "boolean"),
			Entry("pointer to string", reflect.TypeOf((*string)(nil)), "string"),
			Entry("pointer to struct", reflect.TypeOf((*struct{})(nil)), "object"),
		)

		It("should return 'unknown' for nil type", func() {
			Expect(goTypeToJSONTypeName(nil)).To(Equal("unknown"))
		})
	})

})
