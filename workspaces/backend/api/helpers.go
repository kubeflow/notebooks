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
	"bytes"
	"encoding/json"
	jsonv2 "encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"maps"
	"mime"
	"net/http"
	"strings"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// Envelope is the body of all requests and responses that contain data.
// NOTE: error responses use the ErrorEnvelope type
type Envelope[D any] struct {
	// TODO: make all declarations of Envelope use pointers for D

	Data D `json:"data"`
}

// WriteJSON writes a JSON response with the given status code, data, and headers.
func (a *App) WriteJSON(w http.ResponseWriter, status int, data any, headers http.Header) error {

	body, err := json.Marshal(data)
	if err != nil {
		return err
	}

	maps.Copy(w.Header(), headers)

	w.Header().Set("Content-Type", constants.MediaTypeJson)
	w.WriteHeader(status)
	_, err = w.Write(body)
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
// NOTE: we use encoding/json/v2 because its errors include a JSON Pointer to the invalid field.
// NOTE: we read the full body first because encoding/json/v2 returns io.ErrUnexpectedEOF for both empty and truncated bodies.
func (a *App) DecodeJSON(r *http.Request, v any) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}

	if len(bytes.TrimSpace(body)) == 0 {
		return errors.New("request body was empty")
	}

	if err := jsonv2.Unmarshal(body, v, jsonv2.RejectUnknownMembers(true)); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}
	return nil
}

// DecodeRequestBody decodes the JSON request body into v, writing an error response if decoding fails.
// If this method returns false, the request has been handled and the caller should return immediately.
// If this method returns true, the request body was successfully decoded into v.
func (a *App) DecodeRequestBody(w http.ResponseWriter, r *http.Request, v any) bool {
	err := a.DecodeJSON(r, v)
	if err == nil {
		return true
	}
	if a.IsMaxBytesError(err) {
		a.requestEntityTooLargeResponse(w, r, err)
		return false
	}
	if a.IsSemanticError(err) {
		fieldErrs := helper.FieldErrorsFromSemanticError(err, v)
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, fieldErrs, nil)
		return false
	}
	a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
	return false
}

// IsMaxBytesError checks if the error is an instance of http.MaxBytesError.
func (a *App) IsMaxBytesError(err error) bool {
	_, ok := errors.AsType[*http.MaxBytesError](err)
	return ok
}

// IsSemanticError checks if the error is an instance of jsonv2.SemanticError.
func (a *App) IsSemanticError(err error) bool {
	_, ok := errors.AsType[*jsonv2.SemanticError](err)
	return ok
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
