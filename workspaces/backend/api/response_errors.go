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
	"fmt"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

const (
	errMsgPathParamsInvalid    = "path parameters were invalid"
	errMsgRequestBodyInvalid   = "request body was invalid"
	errMsgKubernetesValidation = "kubernetes validation error (note: .cause.validation_errors[] correspond to the internal k8s object, not the request body)"
	errMsgKubernetesConflict   = "kubernetes conflict error (see .cause.conflict_cause[] for details)"
)

// ErrorEnvelope is the body of all error responses.
type ErrorEnvelope struct {
	Error *HTTPError `json:"error"`
}

type HTTPError struct {
	StatusCode int `json:"-"`
	ErrorResponse
}

type ErrorResponse struct {
	// Code is a string representation of the HTTP status code.
	Code string `json:"code"`

	// Message is a human-readable description of the error.
	Message string `json:"message"`

	// Cause contains detailed information about the cause of the error.
	Cause *ErrorCause `json:"cause,omitempty"`
}

type ErrorCause struct {
	// ConflictCauses contains details about conflict errors that caused the request to fail.
	ConflictCauses []ConflictError `json:"conflict_cause,omitempty"`

	// ValidationErrors contains details about validation errors that caused the request to fail.
	ValidationErrors []ValidationError `json:"validation_errors,omitempty"`
}

type ErrorCauseOrigin string

const (
	// OriginInternal indicates the error originated from the internal application logic.
	OriginInternal ErrorCauseOrigin = "INTERNAL"

	// OriginKubernetes indicates the error originated from the Kubernetes API server.
	OriginKubernetes ErrorCauseOrigin = "KUBERNETES"
)

type ConflictError struct {
	// Origin indicates where the conflict error originated.
	// If value is empty, the origin is unknown.
	Origin ErrorCauseOrigin `json:"origin,omitempty"`

	// A human-readable description of the cause of the error.
	// This field may be presented as-is to a reader.
	Message string `json:"message,omitempty"`
}

type ValidationError struct {
	// Origin indicates where the validation error originated.
	// If value is empty, the origin is unknown.
	Origin ErrorCauseOrigin `json:"origin,omitempty"`

	// A machine-readable description of the cause of the error.
	// If value is empty, there is no information available.
	Type field.ErrorType `json:"type,omitempty"`

	// The field of the resource that has caused this error, as named by its JSON serialization.
	// May include dot and postfix notation for nested attributes.
	// Arrays are zero-indexed.
	// Fields may appear more than once in an array of causes due to fields having multiple errors.
	//
	// Examples:
	//   "name" - the field "name" on the current resource
	//   "items[0].name" - the field "name" on the first array entry in "items"
	Field string `json:"field,omitempty"`

	// A human-readable description of the cause of the error.
	// This field may be presented as-is to a reader.
	Message string `json:"message,omitempty"`
}

// errorResponse writes an error response to the client.
func (a *App) errorResponse(w http.ResponseWriter, r *http.Request, httpError *HTTPError) {
	env := ErrorEnvelope{Error: httpError}

	err := a.WriteJSON(w, httpError.StatusCode, env, nil)
	if err != nil {
		a.LogError(r, err)
		w.WriteHeader(httpError.StatusCode)
	}
}

// HTTP: 500
func (a *App) serverErrorResponse(w http.ResponseWriter, r *http.Request, err error) {
	a.LogError(r, err)

	httpError := &HTTPError{
		StatusCode: http.StatusInternalServerError,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusInternalServerError),
			Message: "the server encountered a problem and could not process your request",
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 400
func (a *App) badRequestResponse(w http.ResponseWriter, r *http.Request, err error) {
	httpError := &HTTPError{
		StatusCode: http.StatusBadRequest,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusBadRequest),
			Message: err.Error(),
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 401
func (a *App) unauthorizedResponse(w http.ResponseWriter, r *http.Request) {
	httpError := &HTTPError{
		StatusCode: http.StatusUnauthorized,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusUnauthorized),
			Message: "authentication is required to access this resource",
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 403
func (a *App) forbiddenResponse(w http.ResponseWriter, r *http.Request, msg string) {
	a.LogWarn(r, msg)

	httpError := &HTTPError{
		StatusCode: http.StatusForbidden,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusForbidden),
			Message: "you are not authorized to access this resource",
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 404
func (a *App) notFoundResponse(w http.ResponseWriter, r *http.Request) {
	httpError := &HTTPError{
		StatusCode: http.StatusNotFound,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusNotFound),
			Message: "the requested resource could not be found",
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 405
func (a *App) methodNotAllowedResponse(w http.ResponseWriter, r *http.Request) {
	httpError := &HTTPError{
		StatusCode: http.StatusMethodNotAllowed,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusMethodNotAllowed),
			Message: fmt.Sprintf("the %s method is not supported for this resource", r.Method),
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 409
func (a *App) conflictResponse(w http.ResponseWriter, r *http.Request, err error, k8sCauses []metav1.StatusCause) {
	conflictErrs := make([]ConflictError, len(k8sCauses))

	// convert k8s causes to conflict errors
	for i, cause := range k8sCauses {
		conflictErrs[i] = ConflictError{
			Origin:  OriginKubernetes,
			Message: cause.Message,
		}
	}

	// if we have k8s causes, use a generic message
	// otherwise, use the error message
	var msg string
	if len(conflictErrs) > 0 {
		msg = errMsgKubernetesConflict
	} else {
		msg = err.Error()
	}

	httpError := &HTTPError{
		StatusCode: http.StatusConflict,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusConflict),
			Message: msg,
			Cause: &ErrorCause{
				ConflictCauses: conflictErrs,
			},
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP:413
func (a *App) requestEntityTooLargeResponse(w http.ResponseWriter, r *http.Request, err error) {
	httpError := &HTTPError{
		StatusCode: http.StatusRequestEntityTooLarge,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusRequestEntityTooLarge),
			Message: err.Error(),
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP:415
func (a *App) unsupportedMediaTypeResponse(w http.ResponseWriter, r *http.Request, err error) {
	httpError := &HTTPError{
		StatusCode: http.StatusUnsupportedMediaType,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusUnsupportedMediaType),
			Message: err.Error(),
		},
	}
	a.errorResponse(w, r, httpError)
}

// HTTP: 422
func (a *App) failedValidationResponse(w http.ResponseWriter, r *http.Request, msg string, errs field.ErrorList, k8sCauses []metav1.StatusCause) {
	valErrs := make([]ValidationError, len(errs)+len(k8sCauses))

	// convert field errors to validation errors
	for i, err := range errs {
		valErrs[i] = ValidationError{
			Origin:  OriginInternal,
			Type:    err.Type,
			Field:   err.Field,
			Message: err.ErrorBody(),
		}
	}

	// convert k8s causes to validation errors
	for i, cause := range k8sCauses {
		valErrs[i+len(errs)] = ValidationError{
			Origin:  OriginKubernetes,
			Type:    field.ErrorType(cause.Type),
			Field:   cause.Field,
			Message: cause.Message,
		}
	}

	httpError := &HTTPError{
		StatusCode: http.StatusUnprocessableEntity,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusUnprocessableEntity),
			Message: msg,
			Cause: &ErrorCause{
				ValidationErrors: valErrs,
			},
		},
	}
	a.errorResponse(w, r, httpError)
}
