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

	"github.com/julienschmidt/httprouter"
	httpSwagger "github.com/swaggo/http-swagger/v2"

	"github.com/kubeflow/notebooks/workspaces/backend/openapi"
)

func (a *App) GetSwaggerHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	httpSwagger.Handler(
		// this url is the one that the swagger frontend uses to fetch the OpenAPI definition
		httpSwagger.URL(fmt.Sprintf("%s/swagger/doc.json", openapi.SwaggerInfo.BasePath)),
		httpSwagger.DeepLinking(true),
		httpSwagger.DocExpansion("list"),
		httpSwagger.DomID("swagger-ui"),
	).ServeHTTP(w, r)
}
