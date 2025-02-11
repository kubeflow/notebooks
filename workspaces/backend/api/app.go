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
	"log/slog"
	"net/http"

	"github.com/julienschmidt/httprouter"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
)

const (
	Version    = "1.0.0"
	PathPrefix = "/api/v1"

	// healthcheck
	HealthCheckPath = PathPrefix + "/healthcheck"

	// workspaces
	AllWorkspacesPath         = PathPrefix + "/workspaces"
	NamespacePathParam        = "namespace"
	WorkspaceNamePathParam    = "name"
	WorkspacesByNamespacePath = AllWorkspacesPath + "/:" + NamespacePathParam
	WorkspacesByNamePath      = AllWorkspacesPath + "/:" + NamespacePathParam + "/:" + WorkspaceNamePathParam

	// workspacekinds
	AllWorkspaceKindsPath      = PathPrefix + "/workspacekinds"
	WorkspaceKindNamePathParam = "name"
	WorkspaceKindsByNamePath   = AllWorkspaceKindsPath + "/:" + WorkspaceNamePathParam

	// namespaces
	AllNamespacesPath = PathPrefix + "/namespaces"
)

type App struct {
	Config       *config.EnvConfig
	logger       *slog.Logger
	repositories *repositories.Repositories
	Scheme       *runtime.Scheme
	RequestAuthN authenticator.Request
	RequestAuthZ authorizer.Authorizer
}

// NewApp creates a new instance of the app
func NewApp(cfg *config.EnvConfig, logger *slog.Logger, cl client.Client, scheme *runtime.Scheme, reqAuthN authenticator.Request, reqAuthZ authorizer.Authorizer) (*App, error) {

	// TODO: log the configuration on startup

	app := &App{
		Config:       cfg,
		logger:       logger,
		repositories: repositories.NewRepositories(cl),
		Scheme:       scheme,
		RequestAuthN: reqAuthN,
		RequestAuthZ: reqAuthZ,
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

	// workspaces
	router.GET(AllWorkspacesPath, a.GetWorkspacesHandler)
	router.GET(WorkspacesByNamespacePath, a.GetWorkspacesHandler)
	router.GET(WorkspacesByNamePath, a.GetWorkspaceHandler)
	router.POST(WorkspacesByNamespacePath, a.CreateWorkspaceHandler)
	router.DELETE(WorkspacesByNamePath, a.DeleteWorkspaceHandler)

	// workspacekinds
	router.GET(AllWorkspaceKindsPath, a.GetWorkspaceKindsHandler)
	router.GET(WorkspaceKindsByNamePath, a.GetWorkspaceKindHandler)

	return a.recoverPanic(a.enableCORS(router))
}
