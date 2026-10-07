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
	"errors"
	"fmt"
	"io"
	"maps"
	"mime"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
)

// Envelope is the body of all requests and responses that contain data.
// NOTE: error responses use the ErrorEnvelope type
type Envelope[D any] struct {
	// TODO: make all declarations of Envelope use pointers for D

	Data D `json:"data"`
}

// WriteJSON writes a JSON response with the given status code, data, and headers.
func (a *App) WriteJSON(w http.ResponseWriter, status int, data any, headers http.Header) error {

	bytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	maps.Copy(w.Header(), headers)

	w.Header().Set("Content-Type", constants.MediaTypeJson)
	w.WriteHeader(status)
	_, err = w.Write(bytes)
	if err != nil {
		return err
	}

	return nil
}

// WriteSVG writes an SVG response with the given status code, content, and headers.
//
// SVG is a scriptable document format: when a browser performs a top-level
// navigation to an "image/svg+xml" response, any <script> inside the SVG
// executes on this origin. Since the asset bytes come from a user-controlled
// ConfigMap and are served unsanitized, we set defensive headers so a malicious
// SVG cannot run as a same-origin document (stored XSS):
//   - Content-Security-Policy denies everything: no scripts and no external
//     resource loads (which also closes CSS-based exfiltration). The sandbox
//     directive additionally forces a unique, script-disabled origin if the SVG
//     is ever rendered as a document.
//   - X-Content-Type-Options prevents MIME sniffing to a scriptable type.
//   - Content-Disposition forces a download instead of inline rendering on
//     direct navigation. The frontend fetch()es the bytes and renders them via
//     a data URL, and fetch() ignores Content-Disposition, so in-app display is
//     unaffected.
func (a *App) WriteSVG(w http.ResponseWriter, status int, content []byte, headers http.Header) error {
	maps.Copy(w.Header(), headers)

	w.Header().Set("Content-Type", constants.MediaTypeSVG)
	w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'none'; sandbox")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", `attachment; filename="workspacekind-asset.svg"`)
	w.WriteHeader(status)
	_, err := w.Write(content)
	if err != nil {
		return err
	}

	return nil
}

// DecodeJSON decodes the JSON request body into the given value.
//
// NOTE: this uses encoding/json/v2 (rather than v1) so that type-mismatch errors carry a
// structured jsontext.Pointer (see jsonv2.SemanticError), which — unlike v1's flattened,
// dot-separated UnmarshalTypeError.Field string — unambiguously distinguishes struct fields,
// array indexes, and map keys (including numeric or dotted map keys). See
// FieldErrorsFromSemanticError and JSONPointerToFieldPath.
func (a *App) DecodeJSON(r *http.Request, v any) error {
	if err := jsonv2.UnmarshalRead(r.Body, v, jsonv2.RejectUnknownMembers(true)); err != nil {
		// NOTE: we don't wrap this error so we can unpack it in the caller
		if a.IsMaxBytesError(err) {
			return err
		}

		// NOTE: we don't wrap this error so we can unpack it in the caller
		if a.IsSemanticError(err) {
			return err
		}

		// provide better error message for the case where the body is empty
		// NOTE: io.ErrUnexpectedEOF is returned (instead of v1's io.EOF) when the body is
		//       completely empty or contains only whitespace. If there's any actual JSON
		//       content (even malformed), the decoder returns different errors.
		if a.IsEOFError(err) {
			return fmt.Errorf("request body was empty: %w", err)
		}
		return fmt.Errorf("error decoding JSON: %w", err)
	}
	return nil
}

// IsMaxBytesError checks if the error is an instance of http.MaxBytesError.
func (a *App) IsMaxBytesError(err error) bool {
	var maxBytesError *http.MaxBytesError
	return errors.As(err, &maxBytesError)
}

// IsEOFError checks if the error is an EOF error (empty request body).
// This returns true when the request body is completely empty, which happens when:
// - Content-Length is 0, or
// - The body stream ends immediately without any data (io.EOF / io.ErrUnexpectedEOF)
func (a *App) IsEOFError(err error) bool {
	return errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF)
}

// IsSemanticError checks if the error is an instance of jsonv2.SemanticError representing a
// JSON/Go type mismatch (e.g. a JSON string where a bool is expected).
//
// NOTE: encoding/json/v2 also reports rejected unknown object members (see
// jsonv2.RejectUnknownMembers) as a SemanticError wrapping jsonv2.ErrUnknownName. We deliberately
// exclude that case here so DecodeJSON falls through to its generic "error decoding JSON" error,
// preserving the pre-migration behavior for unknown fields (previously a plain,
// untyped error from json.Decoder.DisallowUnknownFields).
func (a *App) IsSemanticError(err error) bool {
	if _, ok := errors.AsType[*jsonv2.SemanticError](err); !ok {
		return false
	}
	return !errors.Is(err, jsonv2.ErrUnknownName)
}

// FieldErrorsFromSemanticError converts a jsonv2.SemanticError into a field.ErrorList with a
// single entry describing the type mismatch using user-friendly type names.
//
// root must be the Go type that the JSON request body was decoded into (i.e. the type of the
// value passed to DecodeJSON, with any top-level pointer removed), so that the error's JSON
// Pointer can be walked alongside the destination Go types — see JSONPointerToFieldPath.
func FieldErrorsFromSemanticError(err error, root reflect.Type) field.ErrorList {
	semanticError, ok := errors.AsType[*jsonv2.SemanticError](err)
	if !ok {
		return nil
	}

	expectedType := goTypeToJSONTypeName(semanticError.GoType)
	actualType := jsonKindToTypeName(semanticError.JSONKind)
	detail := fmt.Sprintf("got JSON %s, but field requires %s", actualType, expectedType)

	// JSONPointer is empty when the type mismatch occurs at the top level of the JSON
	// (e.g., decoding `"hello"` into a struct), because there is no path to report.
	fieldPath := JSONPointerToFieldPath(root, semanticError.JSONPointer)
	if fieldPath == nil {
		return field.ErrorList{
			{Type: field.ErrorTypeTypeInvalid, BadValue: actualType, Detail: detail},
		}
	}
	return field.ErrorList{
		field.TypeInvalid(fieldPath, actualType, detail),
	}
}

// JSONPointerToFieldPath converts a JSON Pointer (RFC 6901), as produced by jsonv2.SemanticError,
// into a Kubernetes field.Path.
//
// A JSON Pointer token is textually ambiguous on its own: the same token (e.g. "1") can mean
// either an array index or a map key containing the string "1", and a map key containing a "."
// must not be confused with a path through nested struct fields. To resolve this, we walk the
// pointer's tokens alongside root (the Go type the JSON was decoded into), using the type at each
// step to decide whether a token names a struct field, a slice/array index, or a map key.
//
// It returns nil if pointer is empty (i.e. the error occurred at the root value).
func JSONPointerToFieldPath(root reflect.Type, pointer jsontext.Pointer) *field.Path {
	var path *field.Path
	typ := indirect(root)

	for token := range pointer.Tokens() {
		switch {
		case typ != nil && typ.Kind() == reflect.Struct:
			typ = indirect(jsonFieldType(typ, token))
			path = appendChild(path, token)

		case typ != nil && (typ.Kind() == reflect.Slice || typ.Kind() == reflect.Array):
			index, convErr := strconv.Atoi(token)
			switch {
			case convErr != nil:
				// defensive: a jsonv2-produced pointer should always use a valid index
				// token for a slice/array destination.
				path = appendChild(path, token)
			case path == nil:
				path = field.NewPath(token)
			default:
				path = path.Index(index)
			}
			typ = indirect(typ.Elem())

		case typ != nil && typ.Kind() == reflect.Map:
			typ = indirect(typ.Elem())
			if path == nil {
				path = field.NewPath(token)
			} else {
				path = path.Key(token)
			}

		default:
			// unknown or unresolvable type (e.g. an interface{} value, or a type we lost
			// track of because a prior token didn't match any known field): fall back to
			// treating the remaining tokens as struct-style child fields.
			typ = nil
			path = appendChild(path, token)
		}
	}

	return path
}

// appendChild appends token to path as a struct-style child field, creating the root segment
// with token's raw name if path is nil.
func appendChild(path *field.Path, token string) *field.Path {
	if path == nil {
		return field.NewPath(token)
	}
	return path.Child(token)
}

// jsonFieldType returns the Go type of the exported struct field in structType whose JSON name
// (from its `json` tag, or its Go field name if untagged) exactly matches name, mirroring
// encoding/json/v2's default case-sensitive field-name matching. It returns nil if no field
// matches, e.g. if name refers to a member rejected by jsonv2.RejectUnknownMembers.
func jsonFieldType(structType reflect.Type, name string) reflect.Type {
	for f := range structType.Fields() {
		if !f.IsExported() {
			continue
		}
		tag := f.Tag.Get("json")
		if tag == "-" {
			continue
		}
		jsonName, _, _ := strings.Cut(tag, ",")
		if jsonName == "" {
			jsonName = f.Name
		}
		if jsonName == name {
			return f.Type
		}
	}
	return nil
}

// indirect dereferences pointer types until it reaches a non-pointer type. It returns nil if t is
// nil.
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

	// guard against self-referential pointer types (e.g., `type A *A`) which would loop infinitely.
	// this should never occur in practice because jsonv2.SemanticError.GoType is populated by the
	// stdlib JSON decoder, which rejects self-referential pointer types.
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

// jsonKindToTypeName maps a jsontext.Kind (as reported by jsonv2.SemanticError.JSONKind) to the
// same user-friendly JSON type names used by goTypeToJSONTypeName.
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

// ValidateContentType validates the Content-Type header of the request.
// If this method returns false, the request has been handled and the caller should return immediately.
// If this method returns true, the request has the correct Content-Type.
func (a *App) ValidateContentType(w http.ResponseWriter, r *http.Request, expectedMediaType string) bool {
	contentType := r.Header.Get("Content-Type")
	if contentType == "" {
		a.unsupportedMediaTypeResponse(w, r, fmt.Errorf("Content-Type header is missing"))
		return false
	}
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		a.badRequestResponse(w, r, fmt.Errorf("error parsing Content-Type header: %w", err))
		return false
	}
	if mediaType != expectedMediaType {
		a.unsupportedMediaTypeResponse(w, r, fmt.Errorf("unsupported media type: %s, expected: %s", mediaType, expectedMediaType))
		return false
	}

	return true
}

// LocationGetWorkspace returns the GET location (HTTP path) for a workspace resource.
func (a *App) LocationGetWorkspace(namespace, name string) string {
	path := strings.Replace(constants.WorkspacesByNamePath, ":"+constants.NamespacePathParam, namespace, 1)
	path = strings.Replace(path, ":"+constants.ResourceNamePathParam, name, 1)
	return path
}

// LocationGetWorkspaceKind returns the GET location (HTTP path) for a workspace kind resource.
func (a *App) LocationGetWorkspaceKind(name string) string {
	path := strings.Replace(constants.WorkspaceKindsByNamePath, ":"+constants.ResourceNamePathParam, name, 1)
	return path
}

// LocationGetSecret returns the GET location (HTTP path) for a secret resource.
func (a *App) LocationGetSecret(namespace, name string) string {
	path := strings.Replace(constants.SecretsByNamePath, ":"+constants.NamespacePathParam, namespace, 1)
	path = strings.Replace(path, ":"+constants.ResourceNamePathParam, name, 1)
	return path
}
