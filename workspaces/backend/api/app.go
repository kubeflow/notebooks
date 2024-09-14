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
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/data"
)

const (
	Version         = "1.0.0"
	HealthCheckPath = "/api/v1/healthcheck/"
)

type App struct {
	Config config.EnvConfig
	logger *slog.Logger
	models data.Models

	client.Client
	Scheme *runtime.Scheme
}

// NewApp creates a new instance of the app
func NewApp(cfg config.EnvConfig, logger *slog.Logger, client client.Client, scheme *runtime.Scheme) (*App, error) {
	app := &App{
		Config: cfg,
		logger: logger,
		models: data.NewModels(),

		Client: client,
		Scheme: scheme,
	}
	return app, nil
}

// Routes returns the HTTP handler for the app
func (a *App) Routes() http.Handler {
	router := httprouter.New()

	router.NotFound = http.HandlerFunc(a.notFoundResponse)
	router.MethodNotAllowed = http.HandlerFunc(a.methodNotAllowedResponse)

	router.GET(HealthCheckPath, a.HealthcheckHandler)

	return a.RecoverPanic(a.enableCORS(router))
}
