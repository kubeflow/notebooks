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
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Cause   *ErrorCause `json:"cause,omitempty"`
}

type ErrorCause struct {
	ValidationErrors []ValidationError `json:"validation_errors,omitempty"`
}

type ValidationError struct {
	Type    field.ErrorType `json:"type"`
	Field   string          `json:"field"`
	Message string          `json:"message"`
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
func (a *App) conflictResponse(w http.ResponseWriter, r *http.Request, err error) {
	httpError := &HTTPError{
		StatusCode: http.StatusConflict,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusConflict),
			Message: err.Error(),
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
			Type:    err.Type,
			Field:   err.Field,
			Message: err.ErrorBody(),
		}
	}

	// convert k8s causes to validation errors
	for i, cause := range k8sCauses {
		valErrs[i+len(errs)] = ValidationError{
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
