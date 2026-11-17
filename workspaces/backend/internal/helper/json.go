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
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

// FieldErrorsFromSemanticError extracts field errors from a jsonv2.SemanticError.
// NOTE: v must be the value the request body was decoded into.
func FieldErrorsFromSemanticError(err error, v any) field.ErrorList {
	semanticError, ok := errors.AsType[*jsonv2.SemanticError](err)
	if !ok {
		return nil
	}
	root := reflect.TypeOf(v)

	if errors.Is(err, jsonv2.ErrUnknownName) {
		fieldPath := jsonPointerToFieldPath(root, semanticError.JSONPointer)
		return field.ErrorList{
			field.Invalid(fieldPath, nil, "unknown field"),
		}
	}

	actualType := jsonKindToTypeName(semanticError.JSONKind)

	// a non-nil Err means the JSON type was acceptable but the value was rejected (e.g. an out-of-range integer,
	// or an error from a custom UnmarshalJSON like resource.Quantity), so Err is the only meaningful detail
	errType := field.ErrorTypeTypeInvalid
	detail := fmt.Sprintf("got JSON %s, but field requires %s", actualType, goTypeToJSONTypeName(semanticError.GoType))
	if semanticError.Err != nil {
		errType = field.ErrorTypeInvalid
		detail = semanticError.Err.Error()
	}

	// fieldPath is nil when the error is at the root of the JSON
	fieldPath := jsonPointerToFieldPath(root, semanticError.JSONPointer)
	switch {
	case fieldPath == nil:
		return field.ErrorList{
			{Type: errType, BadValue: actualType, Detail: detail},
		}
	case errType == field.ErrorTypeInvalid:
		return field.ErrorList{
			field.Invalid(fieldPath, actualType, detail),
		}
	default:
		return field.ErrorList{
			field.TypeInvalid(fieldPath, actualType, detail),
		}
	}
}

// jsonPointerToFieldPath converts a JSON Pointer into a Kubernetes field.Path, or nil if the pointer is empty.
// NOTE: the Go type is needed to tell struct fields, slice indexes, and map keys apart.
func jsonPointerToFieldPath(root reflect.Type, pointer jsontext.Pointer) *field.Path {
	var path *field.Path
	typ := indirect(root)

	for token := range pointer.Tokens() {
		var kind reflect.Kind
		if typ != nil {
			kind = typ.Kind()
		}

		switch kind { //nolint:exhaustive
		case reflect.Struct:
			typ = indirect(jsonFieldType(typ, token))
			path = appendChild(path, token)

		case reflect.Slice, reflect.Array:
			typ = indirect(typ.Elem())
			index, err := strconv.Atoi(token)
			if err == nil && path != nil {
				path = path.Index(index)
			} else {
				path = appendChild(path, token)
			}

		case reflect.Map:
			typ = indirect(typ.Elem())
			if path != nil {
				path = path.Key(token)
			} else {
				path = appendChild(path, token)
			}

		default:
			// unknown type, treat remaining tokens as child fields
			typ = nil
			path = appendChild(path, token)
		}
	}

	return path
}

// appendChild appends token to path as a child field.
func appendChild(path *field.Path, token string) *field.Path {
	if path == nil {
		return field.NewPath(token)
	}
	return path.Child(token)
}

// jsonFieldType returns the type of the struct field with the given JSON name, or nil if there is no match.
// NOTE: embedded structs are searched breadth-first so the shallowest match wins, the same precedence encoding/json/v2 uses.
func jsonFieldType(structType reflect.Type, name string) reflect.Type {
	// each queue entry is a struct type to search, the outer struct first and then its embedded structs,
	// so a field declared on the outer struct is found before a same-named field promoted from an embedded one
	visited := map[reflect.Type]bool{}
	queue := []reflect.Type{structType}
	for len(queue) > 0 {
		st := queue[0]
		queue = queue[1:]
		// guard against cycles through self-referential embedded structs
		if visited[st] {
			continue
		}
		visited[st] = true

		for f := range st.Fields() {
			// `json:"-"` excludes the field from JSON entirely
			tag := f.Tag.Get("json")
			if tag == "-" {
				continue
			}

			// an embedded struct contributes its fields to this JSON object, so search it later
			// instead of matching it as a named field
			if embeddedType := embeddedStructType(&f); embeddedType != nil {
				queue = append(queue, embeddedType)
				continue
			}

			// NOTE: this is checked after the embedded case because an unexported embedded struct
			//       can still promote exported fields
			if !f.IsExported() {
				continue
			}

			// fields without an explicit JSON name use the Go field name
			jsonName, _, _ := strings.Cut(tag, ",")
			if jsonName == "" {
				jsonName = f.Name
			}
			if jsonName == name {
				return f.Type
			}
		}
	}
	return nil
}

// embeddedStructType returns the struct type whose fields f contributes to the enclosing JSON object, or nil if f is a named field.
// NOTE: a field is embedded if it is Go-embedded without a JSON name, or is tagged `embed` (encoding/json/v2) or `inline` (Kubernetes).
func embeddedStructType(f *reflect.StructField) reflect.Type {
	jsonName, options, _ := strings.Cut(f.Tag.Get("json"), ",")
	tagOptions := strings.Split(options, ",")
	embedded := (f.Anonymous && jsonName == "") ||
		slices.Contains(tagOptions, "inline") ||
		slices.Contains(tagOptions, "embed")
	if !embedded {
		return nil
	}

	// only (pointers to) structs have fields to search, any other embedded type
	// (e.g. an embedded named string, or an inline map) is matched as a named field
	if embeddedType := indirect(f.Type); embeddedType.Kind() == reflect.Struct {
		return embeddedType
	}
	return nil
}

// indirect dereferences pointer types until it reaches a non-pointer type.
func indirect(t reflect.Type) reflect.Type {
	for t != nil && t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	return t
}

const (
	jsonTypeUnknown = "unknown"
	jsonTypeBoolean = "boolean"
	jsonTypeNumber  = "number"
	jsonTypeString  = "string"
	jsonTypeArray   = "array"
	jsonTypeObject  = "object"
	jsonTypeNull    = "null"
)

// goTypeToJSONTypeName maps a Go reflect.Type to a user-friendly JSON type name.
func goTypeToJSONTypeName(t reflect.Type) string {
	var kind reflect.Kind
	if t != nil {
		kind = t.Kind()
	}

	// should never happen, guards against infinite recursion on self-referential pointers (e.g. `type A *A`)
	if kind == reflect.Pointer && t.Elem() == t {
		panic(fmt.Sprintf("goTypeToJSONTypeName: self-referential pointer type: %s", t))
	}

	switch kind { //nolint:exhaustive
	case reflect.Invalid:
		return jsonTypeUnknown
	case reflect.Pointer:
		return goTypeToJSONTypeName(t.Elem())
	case reflect.Bool:
		return jsonTypeBoolean
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return jsonTypeNumber
	case reflect.String:
		return jsonTypeString
	case reflect.Slice, reflect.Array:
		return jsonTypeArray
	case reflect.Map, reflect.Struct:
		return jsonTypeObject
	default:
		return t.String()
	}
}

// jsonKindToTypeName maps a jsontext.Kind to a user-friendly JSON type name.
func jsonKindToTypeName(kind jsontext.Kind) string {
	switch kind { //nolint:exhaustive
	case jsontext.KindTrue, jsontext.KindFalse:
		return jsonTypeBoolean
	case jsontext.KindNumber:
		return jsonTypeNumber
	case jsontext.KindString:
		return jsonTypeString
	case jsontext.KindBeginArray:
		return jsonTypeArray
	case jsontext.KindBeginObject:
		return jsonTypeObject
	case jsontext.KindNull:
		return jsonTypeNull
	default:
		return jsonTypeUnknown
	}
}
