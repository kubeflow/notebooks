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
	"strings"

	"sigs.k8s.io/yaml"
)

// Envelope is the body of all requests and responses that contain data.
// NOTE: error responses use the ErrorEnvelope type
type Envelope[D any] struct {
	// TODO: make all declarations of Envelope use pointers for D

	Data D `json:"data"`
}

// WriteJSON writes a JSON response with the given status code, data, and headers.
func (a *App) WriteJSON(w http.ResponseWriter, status int, data any, headers http.Header) error {

	js, err := json.MarshalIndent(data, "", "\t")
	if err != nil {
		return err
	}

	js = append(js, '\n')

	for key, value := range headers {
		w.Header()[key] = value
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, err = w.Write(js)
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
		return fmt.Errorf("error decoding JSON: %w", err)
	}
	return nil
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
	path := strings.Replace(WorkspacesByNamePath, ":"+NamespacePathParam, namespace, 1)
	path = strings.Replace(path, ":"+ResourceNamePathParam, name, 1)
	return path
}

// ParseYAMLBody reads and decodes a YAML request body into a given destination value,
// after first verifying the 'kind' field in the YAML matches the expectedKind.
// It returns false and handles writing the HTTP error response on any failure.
func (a *App) ParseYAMLBody(w http.ResponseWriter, r *http.Request, dst interface{}, expectedKind string) bool {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		a.badRequestResponse(w, r, errors.New("failed to read request body"))
		return false
	}
	defer func() {
		if err := r.Body.Close(); err != nil {
			a.LogWarn(r, fmt.Sprintf("failed to close request body: %v", err))
		}
	}()

	// First, check the 'kind' field without parsing the whole object.
	type kindCheck struct {
		Kind string `yaml:"kind"`
	}
	var kc kindCheck
	if err := yaml.Unmarshal(body, &kc); err != nil {
		// This handles files that are not valid YAML at all.
		a.badRequestResponse(w, r, errors.New("request body is not a valid YAML manifest"))
		return false
	}

	// Now, validate the 'kind'.
	if kc.Kind != expectedKind {
		a.badRequestResponse(w, r, fmt.Errorf("invalid kind in YAML: expected '%s', got '%s'", expectedKind, kc.Kind))
		return false
	}

	// If kind is correct, parse the full object into the destination struct.
	if err := yaml.Unmarshal(body, dst); err != nil {
		a.badRequestResponse(w, r, fmt.Errorf("request body is not a valid YAML manifest for a %s", expectedKind))
		return false
	}

	return true
}
