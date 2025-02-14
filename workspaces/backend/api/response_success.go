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

import "net/http"

// HTTP: 200
func (a *App) dataResponse(w http.ResponseWriter, r *http.Request, body any) {
	err := a.WriteJSON(w, http.StatusOK, body, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}

// HTTP: 201
func (a *App) createdResponse(w http.ResponseWriter, r *http.Request, body any, location string) {
	w.Header().Set("Location", location)
	err := a.WriteJSON(w, http.StatusCreated, body, nil)
	if err != nil {
		a.serverErrorResponse(w, r, err)
	}
}

// HTTP: 204
func (a *App) deletedResponse(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}
