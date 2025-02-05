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

// LogError logs an error message with the request details.
func (a *App) LogError(r *http.Request, err error) {
	var (
		method = r.Method
		uri    = r.URL.RequestURI()
	)
	a.logger.Error(err.Error(), "method", method, "uri", uri)
}

// LogWarn logs a warning message with the request details.
func (a *App) LogWarn(r *http.Request, message string) {
	var (
		method = r.Method
		uri    = r.URL.RequestURI()
	)
	a.logger.Warn(message, "method", method, "uri", uri)
}

// LogInfo logs an info message with the request details.
func (a *App) LogInfo(r *http.Request, message string) {
	var (
		method = r.Method
		uri    = r.URL.RequestURI()
	)
	a.logger.Info(message, "method", method, "uri", uri)
}
