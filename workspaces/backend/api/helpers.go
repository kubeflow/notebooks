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
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"reflect"
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

	for key, value := range headers {
		w.Header()[key] = value
	}

	w.Header().Set("Content-Type", constants.MediaTypeJson)
	w.WriteHeader(status)
	_, err = w.Write(bytes)
	if err != nil {
		return err
	}

	return nil
}

// WriteSVG writes an SVG response with the given status code, content, and headers.
func (a *App) WriteSVG(w http.ResponseWriter, status int, content []byte, headers http.Header) error {
	for key, value := range headers {
		w.Header()[key] = value
	}

	w.Header().Set("Content-Type", constants.MediaTypeSVG)
	w.WriteHeader(status)
	_, err := w.Write(content)
	if err != nil {
		return err
	}

	return nil
}

// DecodeJSON decodes the JSON request body into the given value.
func (a *App) DecodeJSON(r *http.Request, v any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		// NOTE: we don't wrap this error so we can unpack it in the caller
		if a.IsMaxBytesError(err) {
			return err
		}

		// NOTE: we don't wrap this error so we can unpack it in the caller
		if a.IsUnmarshalTypeError(err) {
			return err
		}

		// provide better error message for the case where the body is empty
		// NOTE: io.EOF is only returned when the body is completely empty or contains only whitespace.
		//       If there's any actual JSON content (even malformed), json.Decoder returns different errors.
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
// - The body stream ends immediately without any data (io.EOF)
func (a *App) IsEOFError(err error) bool {
	return errors.Is(err, io.EOF)
}

// IsUnmarshalTypeError checks if the error is an instance of json.UnmarshalTypeError.
func (a *App) IsUnmarshalTypeError(err error) bool {
	var unmarshalTypeError *json.UnmarshalTypeError
	return errors.As(err, &unmarshalTypeError)
}

// FieldErrorsFromUnmarshalTypeError converts a json.UnmarshalTypeError into a field.ErrorList
// with a single entry describing the type mismatch using user-friendly type names.
func FieldErrorsFromUnmarshalTypeError(err error) field.ErrorList {
	var unmarshalTypeError *json.UnmarshalTypeError
	if !errors.As(err, &unmarshalTypeError) {
		return nil
	}

	expectedType := goTypeToJSONTypeName(unmarshalTypeError.Type)
	detail := fmt.Sprintf("got JSON %s, but field requires %s", unmarshalTypeError.Value, expectedType)

	if unmarshalTypeError.Field == "" {
		return field.ErrorList{
			{Type: field.ErrorTypeTypeInvalid, BadValue: unmarshalTypeError.Value, Detail: detail},
		}
	}

	fieldPath := fieldPathFromJSONPath(unmarshalTypeError.Field)
	return field.ErrorList{
		field.TypeInvalid(fieldPath, unmarshalTypeError.Value, detail),
	}
}

// fieldPathFromJSONPath converts a dot-separated JSON field path (e.g., "data.podTemplate.paused")
// into a field.Path.
func fieldPathFromJSONPath(jsonPath string) *field.Path {
	parts := strings.Split(jsonPath, ".")
	path := field.NewPath(parts[0])
	for _, part := range parts[1:] {
		path = path.Child(part)
	}
	return path
}

// goTypeToJSONTypeName maps a Go reflect.Type to a user-friendly JSON type name.
func goTypeToJSONTypeName(t reflect.Type) string {
	if t == nil {
		return "unknown"
	}
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	switch t.Kind() { //nolint:exhaustive
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return "number"
	case reflect.String:
		return "string"
	case reflect.Slice, reflect.Array:
		return "array"
	case reflect.Map, reflect.Struct:
		return "object"
	default:
		return t.String()
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
