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
	"log/slog"
	"net/http"

	"github.com/julienschmidt/httprouter"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
	_ "github.com/kubeflow/notebooks/workspaces/backend/openapi"
)

const (
	Version    = "1.0.0"
	PathPrefix = "/api/v1"

	MediaTypeJson = "application/json"
	MediaTypeYaml = "application/yaml"

	NamespacePathParam    = "namespace"
	ResourceNamePathParam = "name"

	// healthcheck
	HealthCheckPath = PathPrefix + "/healthcheck"

	// workspaces
	AllWorkspacesPath         = PathPrefix + "/workspaces"
	WorkspacesByNamespacePath = AllWorkspacesPath + "/:" + NamespacePathParam
	WorkspacesByNamePath      = AllWorkspacesPath + "/:" + NamespacePathParam + "/:" + ResourceNamePathParam
	WorkspaceActionsPath      = WorkspacesByNamePath + "/actions"
	PauseWorkspacePath        = WorkspaceActionsPath + "/pause"

	// workspacekinds
	AllWorkspaceKindsPath    = PathPrefix + "/workspacekinds"
	WorkspaceKindsByNamePath = AllWorkspaceKindsPath + "/:" + ResourceNamePathParam

	// namespaces
	AllNamespacesPath = PathPrefix + "/namespaces"

	// secrets
	SecretsByNamespacePath = PathPrefix + "/secrets/:" + NamespacePathParam
	SecretsByNamePath      = SecretsByNamespacePath + "/:" + ResourceNamePathParam

	// swagger
	SwaggerPath    = PathPrefix + "/swagger/*any"
	SwaggerDocPath = PathPrefix + "/swagger/doc.json"
)

type App struct {
	Config               *config.EnvConfig
	logger               *slog.Logger
	repositories         *repositories.Repositories
	Scheme               *runtime.Scheme
	StrictYamlSerializer runtime.Serializer
	RequestAuthN         authenticator.Request
	RequestAuthZ         authorizer.Authorizer
}

// NewApp creates a new instance of the app
func NewApp(cfg *config.EnvConfig, logger *slog.Logger, cl client.Client, scheme *runtime.Scheme, reqAuthN authenticator.Request, reqAuthZ authorizer.Authorizer) (*App, error) {

	// TODO: log the configuration on startup

	// get a serializer for Kubernetes YAML
	codecFactory := serializer.NewCodecFactory(scheme)
	yamlSerializerInfo, found := runtime.SerializerInfoForMediaType(codecFactory.SupportedMediaTypes(), runtime.ContentTypeYAML)
	if !found {
		return nil, fmt.Errorf("unable to find Kubernetes serializer for media type: %s", runtime.ContentTypeYAML)
	}

	app := &App{
		Config:               cfg,
		logger:               logger,
		repositories:         repositories.NewRepositories(cl),
		Scheme:               scheme,
		StrictYamlSerializer: yamlSerializerInfo.StrictSerializer,
		RequestAuthN:         reqAuthN,
		RequestAuthZ:         reqAuthZ,
	}
	return app, nil
}

// Routes returns the HTTP handler for the app
func (a *App) Routes() http.Handler {
	router := httprouter.New()

	router.NotFound = http.HandlerFunc(a.notFoundResponse)
	router.MethodNotAllowed = http.HandlerFunc(a.methodNotAllowedResponse)

	// healthcheck
	router.GET(HealthCheckPath, a.GetHealthcheckHandler)

	// namespaces
	router.GET(AllNamespacesPath, a.GetNamespacesHandler)

	// secrets
	router.GET(SecretsByNamespacePath, a.GetSecretsByNamespaceHandler)
	router.POST(SecretsByNamespacePath, a.CreateSecretHandler)
	router.GET(SecretsByNamePath, a.GetSecretHandler)
	router.PUT(SecretsByNamePath, a.UpdateSecretHandler)
	router.DELETE(SecretsByNamePath, a.DeleteSecretHandler)

	// workspaces
	router.GET(AllWorkspacesPath, a.GetAllWorkspacesHandler)
	router.GET(WorkspacesByNamespacePath, a.GetWorkspacesByNamespaceHandler)
	router.GET(WorkspacesByNamePath, a.GetWorkspaceHandler)
	router.POST(WorkspacesByNamespacePath, a.CreateWorkspaceHandler)
	router.PUT(WorkspacesByNamePath, a.UpdateWorkspaceHandler)
	router.DELETE(WorkspacesByNamePath, a.DeleteWorkspaceHandler)
	router.POST(PauseWorkspacePath, a.PauseActionWorkspaceHandler)

	// workspacekinds
	router.GET(AllWorkspaceKindsPath, a.GetWorkspaceKindsHandler)
	router.GET(WorkspaceKindsByNamePath, a.GetWorkspaceKindHandler)
	router.POST(AllWorkspaceKindsPath, a.CreateWorkspaceKindHandler)

	// swagger
	router.GET(SwaggerPath, a.GetSwaggerHandler)

	return a.recoverPanic(a.enableCORS(router))
}
