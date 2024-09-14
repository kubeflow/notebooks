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

	"github.com/kubeflow/notebooks/workspaces/backend/config"
	"github.com/kubeflow/notebooks/workspaces/backend/data"
	"github.com/kubeflow/notebooks/workspaces/backend/integrations"

	"github.com/julienschmidt/httprouter"
)

const (
	Version            = "1.0.0"
	NamespacePathParam = "namespace"
	PathPrefix         = "/api/v1/workspaces/:" + NamespacePathParam
	HealthCheckPath    = PathPrefix + "/healthcheck"
	WorkspacesPath     = PathPrefix + "/workspaces"
)

type App struct {
	config           config.EnvConfig
	logger           *slog.Logger
	models           data.Models
	kubernetesClient *integrations.KubernetesClient
}

func NewApp(cfg config.EnvConfig, logger *slog.Logger) (*App, error) {
	k8sClient, err := integrations.NewKubernetesClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	app := &App{
		config:           cfg,
		logger:           logger,
		kubernetesClient: k8sClient,
	}
	return app, nil
}

func (app *App) Routes() http.Handler {
	router := httprouter.New()

	router.NotFound = http.HandlerFunc(app.notFoundResponse)
	router.MethodNotAllowed = http.HandlerFunc(app.methodNotAllowedResponse)

	router.GET(HealthCheckPath, app.HealthcheckHandler)
	router.GET(WorkspacesPath, app.GetWorkspaceHandler)

	return app.RecoverPanic(app.enableCORS(router))
}
