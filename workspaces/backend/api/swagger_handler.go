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

	"github.com/julienschmidt/httprouter"
	httpSwagger "github.com/swaggo/http-swagger/v2"
	"github.com/swaggo/swag"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/openapi"
)

// swaggerDocPath is the internal route path (rooted at constants.PathPrefix) at which the Go
// handler sees requests for the OpenAPI definition. This is distinct from the external browser
// path used by httpSwagger.URL() (see openapi.SwaggerInfo.BasePath below).
var swaggerDocPath = constants.PathPrefix + "/swagger/doc.json"

const (
	// userIdSecurityScheme is the name of the security scheme which we inject into the OpenAPI
	// definition served by the Swagger UI, so users can set the user id header with the
	// "Authorize" button.
	//
	// NOTE: the name of the user id header is configurable (see EnvConfig.UserIdHeader), so this
	//       scheme can only be resolved at runtime, and is not part of `openapi/swagger.json`.
	userIdSecurityScheme = "UserIdHeader"

	// defaultSwaggerUserId is the user id which the Swagger UI is pre-authorized with, so
	// "Try it out" works without any manual steps.
	//
	// NOTE: this matches the user which is bound to the admin ClusterRole in the Tilt dev cluster.
	defaultSwaggerUserId = "admin"
)

func (a *App) GetSwaggerHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	// intercept the OpenAPI definition, so we can inject the user id header security scheme
	if r.URL.Path == swaggerDocPath {
		a.serveSwaggerDoc(w, r)
		return
	}

	httpSwagger.Handler(
		// this url is the one that the swagger frontend uses to fetch the OpenAPI definition
		httpSwagger.URL(fmt.Sprintf("%s/swagger/doc.json", openapi.SwaggerInfo.BasePath)),
		httpSwagger.DeepLinking(true),
		httpSwagger.DocExpansion("list"),
		httpSwagger.DomID("swagger-ui"),
		httpSwagger.PersistAuthorization(true),
		// pre-authorize the UI with a default user id, so "Try it out" works out of the box
		//
		// NOTE: this must run from the `onComplete` callback, which fires once the definition has
		//       been fetched and rendered, rather than from `AfterScript`, which runs right after
		//       `SwaggerUIBundle()` returns, before the security schemes have loaded (in which
		//       case `preauthorizeApiKey` silently does nothing).
		httpSwagger.UIConfig(map[string]string{
			"onComplete": fmt.Sprintf(`() => { window.ui.preauthorizeApiKey(%q, %q) }`, userIdSecurityScheme, defaultSwaggerUserId),
		}),
	).ServeHTTP(w, r)
}

// serveSwaggerDoc serves the OpenAPI definition with the user id header security scheme injected.
func (a *App) serveSwaggerDoc(w http.ResponseWriter, r *http.Request) {
	doc, err := swag.ReadDoc(openapi.SwaggerInfo.InstanceName())
	if err != nil {
		a.serverErrorResponse(w, r, fmt.Errorf("failed to read OpenAPI definition: %w", err))
		return
	}

	var spec map[string]any
	if err := json.Unmarshal([]byte(doc), &spec); err != nil {
		a.serverErrorResponse(w, r, fmt.Errorf("failed to unmarshal OpenAPI definition: %w", err))
		return
	}

	spec["securityDefinitions"] = map[string]any{
		userIdSecurityScheme: map[string]any{
			"type": "apiKey",
			"in":   "header",
			"name": a.Config.UserIdHeader,
			"description": fmt.Sprintf(
				"The %q header, which identifies the user making the request. "+
					"In production, this header is typically set by an authenticating proxy (e.g. oauth2-proxy). <br><br>"+
					"<b>Note:</b> The Swagger UI is pre-authorized as %q by default, click \"Logout\" and enter another value to send the requests as a different user.",
				a.Config.UserIdHeader, defaultSwaggerUserId,
			),
		},
	}
	spec["security"] = []any{
		map[string]any{userIdSecurityScheme: []any{}},
	}

	out, err := json.Marshal(spec)
	if err != nil {
		a.serverErrorResponse(w, r, fmt.Errorf("failed to marshal OpenAPI definition: %w", err))
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if _, err := w.Write(out); err != nil {
		a.logger.Error("failed to write OpenAPI definition", "error", err)
	}
}
