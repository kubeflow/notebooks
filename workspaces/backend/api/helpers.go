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
	"io"
	"mime"
	"net/http"
	"strings"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
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

func ParseYAMLBody(w http.ResponseWriter, r *http.Request, target interface{}) bool {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return false
	}

	if err := r.Body.Close(); err != nil {
		fmt.Printf("Failed to close request body: %v", err)
		return false
	}

	if err := yaml.UnmarshalStrict(body, target); err != nil {
		http.Error(w, "Invalid YAML: "+err.Error(), http.StatusBadRequest)
		return false
	}
	return true
}

type ImmutableFieldError struct {
	Field    string
	BadValue interface{}
	Detail   string
}

func (e *ImmutableFieldError) Error() string {
	return fmt.Sprintf("Field %s is immutable: %v", e.Field, e.Detail)
}

func validateImmutableFields(newObj, oldObj *kubefloworgv1beta1.WorkspaceKind) *ImmutableFieldError {
	if newObj.Name != oldObj.Name {
		return &ImmutableFieldError{Field: "metadata.name", BadValue: newObj.Name, Detail: "must match existing resource name"}
	}

	if newObj.Spec.PodTemplate.ServiceAccount.Name != oldObj.Spec.PodTemplate.ServiceAccount.Name {
		return &ImmutableFieldError{Field: "spec.podTemplate.serviceAccount.name", BadValue: newObj.Spec.PodTemplate.ServiceAccount.Name, Detail: "service account name is immutable"}
	}

	if newObj.Spec.PodTemplate.VolumeMounts.Home != oldObj.Spec.PodTemplate.VolumeMounts.Home {
		return &ImmutableFieldError{Field: "spec.volumeMounts.home", BadValue: newObj.Spec.PodTemplate.VolumeMounts.Home, Detail: "home volume is immutable"}
	}

	if !idsPreservedOnly(
		newObj.Spec.PodTemplate.Options.ImageConfig.Values,
		oldObj.Spec.PodTemplate.Options.ImageConfig.Values,
		func(v kubefloworgv1beta1.ImageConfigValue) string { return v.Id },
	) {
		return &ImmutableFieldError{
			Field:    "spec.options.imageConfig.values",
			BadValue: newObj.Spec.PodTemplate.Options.ImageConfig.Values,
			Detail:   "image config keys cannot be removed or renamed",
		}
	}

	if !idsPreservedOnly(
		newObj.Spec.PodTemplate.Options.PodConfig.Values,
		oldObj.Spec.PodTemplate.Options.PodConfig.Values,
		func(v kubefloworgv1beta1.PodConfigValue) string { return v.Id },
	) {
		return &ImmutableFieldError{
			Field:    "spec.options.podConfig.values",
			BadValue: newObj.Spec.PodTemplate.Options.PodConfig.Values,
			Detail:   "pod config keys cannot be removed or renamed",
		}
	}

	return nil
}

// `getID` extracts the unique key from each element.
func idsPreservedOnly[T any](a, b []T, getID func(T) string) bool {
	fmt.Printf("Comparing slices:\nA: %+v\nB: %+v\n\n", a, b)
	if len(a) != len(b) {
		fmt.Printf("Length mismatch: len(a)=%d, len(b)=%d\n", len(a), len(b))
		return false
	}

	mapA := make(map[string]T)
	mapB := make(map[string]T)

	for i, item := range a {
		id := getID(item)
		mapA[id] = item
		fmt.Printf("mapA[%q] = a[%d] => %+v\n", id, i, item)
	}
	for i, item := range b {
		id := getID(item)
		mapB[id] = item
		fmt.Printf("mapB[%q] = b[%d] => %+v\n", id, i, item)
	}

	fmt.Println()

	for id := range mapA {
		_, exists := mapB[id]
		if !exists {
			fmt.Printf("ID %q found in A but not in B\n", id)
			return false
		}
	}
	fmt.Println("All IDs matched.")
	return true
}
