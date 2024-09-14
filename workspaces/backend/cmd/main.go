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

package main

import (
	"flag"
	"log/slog"
	"os"
	"strconv"

	ctrl "sigs.k8s.io/controller-runtime"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	application "github.com/kubeflow/notebooks/workspaces/backend/api"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/server"
)

func main() {
	var cfg config.EnvConfig
	flag.IntVar(&cfg.Port, "port", getEnvAsInt("PORT", 4000), "API server port")

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	kubeconfig, err := helper.GetKubeconfig()
	if err != nil {
		logger.Error("failed to get kubeconfig", "error", err)
		os.Exit(1)
	}
	scheme, err := helper.BuildScheme()
	if err != nil {
		logger.Error("failed to build Kubernetes scheme", "error", err)
		os.Exit(1)
	}
	mgr, err := ctrl.NewManager(kubeconfig, ctrl.Options{
		Scheme: scheme,
		Metrics: metricsserver.Options{
			BindAddress: "0", // disable metrics serving
		},
		HealthProbeBindAddress: "0", // disable health probe serving
		LeaderElection:         false,
	})
	if err != nil {
		logger.Error("unable to create manager", "error", err)
		os.Exit(1)
	}

	app, err := application.NewApp(cfg, logger, mgr.GetClient(), mgr.GetScheme())
	if err != nil {
		logger.Error("failed to create app", "error", err)
		os.Exit(1)
	}
	svr, err := server.NewServer(app, logger)
	if err != nil {
		logger.Error("failed to create server", "error", err)
		os.Exit(1)
	}
	if err := svr.SetupWithManager(mgr); err != nil {
		logger.Error("failed to setup server with manager", "error", err)
		os.Exit(1)
	}

	logger.Info("starting manager")
	if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
		logger.Error("problem running manager", "error", err)
		os.Exit(1)
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}

func getEnvAsInt(name string, defaultVal int) int {
	if value, exists := os.LookupEnv(name); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultVal
}
