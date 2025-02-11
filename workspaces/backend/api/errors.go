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
	"strconv"
)

type HTTPError struct {
	StatusCode int `json:"-"`
	ErrorResponse
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorEnvelope struct {
	Error *HTTPError `json:"error"`
}

func (a *App) LogError(r *http.Request, err error) {
	var (
		method = r.Method
		uri    = r.URL.RequestURI()
	)

	a.logger.Error(err.Error(), "method", method, "uri", uri)
}

func (a *App) LogWarn(r *http.Request, message string) {
	var (
		method = r.Method
		uri    = r.URL.RequestURI()
	)

	a.logger.Warn(message, "method", method, "uri", uri)
}

//nolint:unused
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

func (a *App) errorResponse(w http.ResponseWriter, r *http.Request, httpError *HTTPError) {
	env := ErrorEnvelope{Error: httpError}

	err := a.WriteJSON(w, httpError.StatusCode, env, nil)
	if err != nil {
		a.LogError(r, err)
		w.WriteHeader(httpError.StatusCode)
	}
}

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

//nolint:unused
func (a *App) failedValidationResponse(w http.ResponseWriter, r *http.Request, errors map[string]string) {
	message, err := json.Marshal(errors)
	if err != nil {
		message = []byte("{}")
	}

	httpError := &HTTPError{
		StatusCode: http.StatusUnprocessableEntity,
		ErrorResponse: ErrorResponse{
			Code:    strconv.Itoa(http.StatusUnprocessableEntity),
			Message: string(message),
		},
	}
	a.errorResponse(w, r, httpError)
}
