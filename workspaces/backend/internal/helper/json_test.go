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
	"encoding/json/jsontext"
	jsonv2 "encoding/json/v2"
	"fmt"
	"reflect"
	"strconv"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var _ = Describe("JSON Helpers", func() {

	Describe("FieldErrorsFromSemanticError", func() {

		// root mirrors the shape of a typical request envelope
		type fieldErrorsFixtureData struct {
			Paused      bool              `json:"paused"`
			Name        string            `json:"name"`
			Port        int32             `json:"port"`
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
		root := &fieldErrorsFixtureEnvelope{}

		DescribeTable("should translate a SemanticError into field errors",
			func(err error, expected field.ErrorList) {
				result := FieldErrorsFromSemanticError(err, root)
				if expected == nil {
					Expect(result).To(BeNil())
				} else {
					Expect(result).To(ConsistOf(expected))
				}
			},
			Entry("return nil for a non-SemanticError",
				fmt.Errorf("some generic error"),
				nil,
			),
			Entry("convert string-for-bool type mismatch",
				&jsonv2.SemanticError{JSONPointer: "/data/paused", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[bool]()},
				field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), jsonTypeString, "got JSON string, but field requires boolean"),
				},
			),
			Entry("convert number-for-string type mismatch",
				&jsonv2.SemanticError{JSONPointer: "/data/name", JSONKind: jsontext.KindNumber, GoType: reflect.TypeFor[string]()},
				field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("name"), jsonTypeNumber, "got JSON number, but field requires string"),
				},
			),
			Entry("convert string-for-array type mismatch",
				&jsonv2.SemanticError{JSONPointer: "/data/accessModes", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[[]string]()},
				field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("accessModes"), jsonTypeString, "got JSON string, but field requires array"),
				},
			),
			Entry("convert string-for-object (map) type mismatch",
				&jsonv2.SemanticError{JSONPointer: "/data/contents", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[map[string]string]()},
				field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("contents"), jsonTypeString, "got JSON string, but field requires object"),
				},
			),
			Entry("handle an empty JSON Pointer (top-level type mismatch)",
				&jsonv2.SemanticError{JSONPointer: "", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[fieldErrorsFixtureEnvelope]()},
				field.ErrorList{
					{Type: field.ErrorTypeTypeInvalid, BadValue: jsonTypeString, Detail: "got JSON string, but field requires object"},
				},
			),
			Entry("dereference a pointer GoType for the expected-type message",
				&jsonv2.SemanticError{JSONPointer: "/data/paused", JSONKind: jsontext.KindNumber, GoType: reflect.TypeFor[*bool]()},
				field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("paused"), jsonTypeNumber, "got JSON number, but field requires boolean"),
				},
			),
			Entry("handle deeply nested field paths",
				&jsonv2.SemanticError{JSONPointer: "/data/podTemplate/options/imageConfig", JSONKind: jsontext.KindTrue, GoType: reflect.TypeFor[string]()},
				field.ErrorList{
					field.TypeInvalid(field.NewPath("data").Child("podTemplate").Child("options").Child("imageConfig"), jsonTypeBoolean, "got JSON boolean, but field requires string"),
				},
			),
			Entry("report the underlying error for a value the field's type rejects (out-of-range integer)",
				&jsonv2.SemanticError{JSONPointer: "/data/port", JSONKind: jsontext.KindNumber, GoType: reflect.TypeFor[int32](), Err: strconv.ErrRange},
				field.ErrorList{
					field.Invalid(field.NewPath("data").Child("port"), jsonTypeNumber, "value out of range"),
				},
			),
			Entry("report the underlying error for a value rejected by a custom UnmarshalJSON (not the Go struct kind)",
				&jsonv2.SemanticError{JSONPointer: "/data/contents/cpu", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[struct{}](), Err: fmt.Errorf("quantities must match the regular expression")},
				field.ErrorList{
					field.Invalid(field.NewPath("data").Child("contents").Key("cpu"), jsonTypeString, "quantities must match the regular expression"),
				},
			),
			Entry("report the underlying error for a rejected value at the root of the JSON",
				&jsonv2.SemanticError{JSONPointer: "", JSONKind: jsontext.KindString, GoType: reflect.TypeFor[struct{}](), Err: fmt.Errorf("value rejected")},
				field.ErrorList{
					{Type: field.ErrorTypeInvalid, BadValue: jsonTypeString, Detail: "value rejected"},
				},
			),
			Entry("convert a rejected unknown member into an 'unknown field' error",
				&jsonv2.SemanticError{JSONPointer: "/data/bogus", Err: jsonv2.ErrUnknownName},
				field.ErrorList{
					field.Invalid(field.NewPath("data").Child("bogus"), nil, "unknown field"),
				},
			),
			Entry("convert a case-mismatched field name into an 'unknown field' error",
				&jsonv2.SemanticError{JSONPointer: "/data/Paused", Err: jsonv2.ErrUnknownName},
				field.ErrorList{
					field.Invalid(field.NewPath("data").Child("Paused"), nil, "unknown field"),
				},
			),
			Entry("report an unknown member nested under a struct field using its JSON Pointer",
				&jsonv2.SemanticError{JSONPointer: "/data/podTemplate/options/extra", Err: jsonv2.ErrUnknownName},
				field.ErrorList{
					field.Invalid(field.NewPath("data").Child("podTemplate").Child("options").Child("extra"), nil, "unknown field"),
				},
			),
		)
	})

	Describe("jsonPointerToFieldPath", func() {
		// pathFixtureVolume embeds structs the same ways as corev1.Volume (inline tag, untagged, and pointer)
		type pathFixtureKeyToPath struct {
			Key string `json:"key"`
		}
		type pathFixtureObjectReference struct {
			Name string `json:"name"`
		}
		type pathFixtureConfigMap struct {
			pathFixtureObjectReference `json:",inline"`
			Items                      []pathFixtureKeyToPath `json:"items"`
		}
		type pathFixtureVolumeSource struct {
			ConfigMap *pathFixtureConfigMap `json:"configMap"`
		}
		type pathFixtureSecretSource struct {
			Items []pathFixtureKeyToPath `json:"secretItems"`
		}
		type PathFixtureProjectedSource struct {
			Sources []pathFixtureKeyToPath `json:"sources"`
		}
		type pathFixtureVolume struct {
			pathFixtureVolumeSource `json:",inline"`
			pathFixtureSecretSource
			*PathFixtureProjectedSource
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
				path := jsonPointerToFieldPath(root, pointer)
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
			Entry("slice index after a member of an inline embedded struct",
				jsontext.Pointer("/podTemplate/volumes/0/configMap/items/1/key"), "podTemplate.volumes[0].configMap.items[1].key"),
			Entry("member of a nested inline embedded struct",
				jsontext.Pointer("/podTemplate/volumes/0/configMap/name"), "podTemplate.volumes[0].configMap.name"),
			Entry("slice index after a member of an untagged embedded struct",
				jsontext.Pointer("/podTemplate/volumes/0/secretItems/2/key"), "podTemplate.volumes[0].secretItems[2].key"),
			Entry("slice index after a member of an embedded struct pointer",
				jsontext.Pointer("/podTemplate/volumes/0/sources/3/key"), "podTemplate.volumes[0].sources[3].key"),
			Entry("map key", jsontext.Pointer("/contents/foo/base64"), "contents[foo].base64"),
			Entry("dotted map key is not confused with nested fields", jsontext.Pointer("/contents/tls.crt/base64"), "contents[tls.crt].base64"),
			Entry("numeric map key is not confused with a slice index", jsontext.Pointer("/contents/1/base64"), "contents[1].base64"),
			Entry("JSON Pointer escaping (~1 for '/') is decoded by Tokens()", jsontext.Pointer("/contents/a~1b/base64"), "contents[a/b].base64"),
			Entry("unresolvable token falls back to a child field (defensive)", jsontext.Pointer("/doesNotExist"), "doesNotExist"),
		)
	})

	Describe("jsonFieldType", func() {
		// each field below demonstrates one rule for resolving a JSON name, and uses a distinct Go type
		// so the assertion shows exactly which field was matched
		type fieldTypeFixturePromoted struct {
			Promoted float32 `json:"promoted"`
			Shadowed string  `json:"shadowed"`
		}
		type fieldTypeFixtureInline struct {
			InlineField int8 `json:"inlineField"`
		}
		type fieldTypeFixtureEmbed struct {
			EmbedField int16 `json:"embedField"`
		}
		type fieldTypeFixtureUnexported struct {
			FromUnexported int32 `json:"fromUnexported"`
		}
		type FieldTypeFixtureNamed struct {
			Hidden uint8 `json:"hidden"`
		}
		type FieldTypeFixtureLabel string
		type fieldTypeFixture struct {
			fieldTypeFixturePromoted
			Inline *fieldTypeFixtureInline `json:",inline"`
			Embed  fieldTypeFixtureEmbed   `json:",embed"`
			fieldTypeFixtureUnexported
			FieldTypeFixtureNamed `json:"named"`
			FieldTypeFixtureLabel
			Shadowed   int    `json:"shadowed"`
			Tagged     uint16 `json:"tagged"`
			Untagged   uint32
			Ignored    uint64 `json:"-"`
			unexported bool   //nolint:unused
		}
		root := reflect.TypeFor[fieldTypeFixture]()

		DescribeTable("should resolve a JSON name to the type of the struct field it decodes into",
			func(name string, expected reflect.Type) {
				result := jsonFieldType(root, name)
				if expected == nil {
					Expect(result).To(BeNil())
				} else {
					Expect(result).To(Equal(expected))
				}
			},
			Entry("a field matches its JSON tag name", "tagged", reflect.TypeFor[uint16]()),
			Entry("a field without a JSON tag name matches its Go field name", "Untagged", reflect.TypeFor[uint32]()),
			Entry("JSON names match case-sensitively", "Tagged", nil),
			Entry("a field of an untagged Go-embedded struct is promoted", "promoted", reflect.TypeFor[float32]()),
			Entry("a field of a struct tagged `inline` is promoted (through a pointer)", "inlineField", reflect.TypeFor[int8]()),
			Entry("a field of a struct tagged `embed` is promoted", "embedField", reflect.TypeFor[int16]()),
			Entry("a field of an unexported Go-embedded struct is promoted", "fromUnexported", reflect.TypeFor[int32]()),
			Entry("an outer field shadows a same-named promoted field", "shadowed", reflect.TypeFor[int]()),
			Entry("a Go-embedded struct with a JSON name is a named field", "named", reflect.TypeFor[FieldTypeFixtureNamed]()),
			Entry("a Go-embedded struct with a JSON name does not promote its fields", "hidden", nil),
			Entry("a Go-embedded non-struct type is a named field", "FieldTypeFixtureLabel", reflect.TypeFor[FieldTypeFixtureLabel]()),
			Entry("a field tagged `json:\"-\"` is skipped", "Ignored", nil),
			Entry("an unexported field is skipped", "unexported", nil),
			Entry("an unknown name has no match", "doesNotExist", nil),
		)

		It("should terminate when a struct embeds itself", func() {
			type fieldTypeFixtureCycle struct {
				*fieldTypeFixtureCycle      //nolint:unused
				Leaf                   bool `json:"leaf"`
			}
			cycle := reflect.TypeFor[fieldTypeFixtureCycle]()
			Expect(jsonFieldType(cycle, "leaf")).To(Equal(reflect.TypeFor[bool]()))
			Expect(jsonFieldType(cycle, "doesNotExist")).To(BeNil())
		})
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
