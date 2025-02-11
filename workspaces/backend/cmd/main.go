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
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/server"
)

func main() {
	// Define command line flags
	cfg := &config.EnvConfig{}
	flag.IntVar(&cfg.Port,
		"port",
		getEnvAsInt("PORT", 4000),
		"API server port",
	)
	flag.Float64Var(
		&cfg.ClientQPS,
		"client-qps",
		getEnvAsFloat64("CLIENT_QPS", 50),
		"QPS configuration passed to rest.Client",
	)
	flag.IntVar(
		&cfg.ClientBurst,
		"client-burst",
		getEnvAsInt("CLIENT_BURST", 100),
		"Maximum Burst configuration passed to rest.Client",
	)
	flag.BoolVar(
		// TODO: remove before GA
		&cfg.DisableAuth,
		"disable-auth",
		getEnvAsBool("DISABLE_AUTH", true),
		"Disable authentication and authorization",
	)
	flag.StringVar(
		&cfg.UserIdHeader,
		"userid-header",
		getEnvAsStr("USERID_HEADER", "kubeflow-userid"),
		"Key of request header containing user id",
	)
	flag.StringVar(
		&cfg.UserIdPrefix,
		"userid-prefix",
		getEnvAsStr("USERID_PREFIX", ":"),
		"Request header user id common prefix",
	)
	flag.StringVar(
		&cfg.GroupsHeader,
		"groups-header",
		getEnvAsStr("GROUPS_HEADER", "kubeflow-groups"),
		"Key of request header containing user groups",
	)

	// Initialize the logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	// Build the Kubernetes client configuration
	kubeconfig, err := ctrl.GetConfig()
	if err != nil {
		logger.Error("failed to get Kubernetes config", "error", err)
		os.Exit(1)
	}
	kubeconfig.QPS = float32(cfg.ClientQPS)
	kubeconfig.Burst = cfg.ClientBurst

	// Build the Kubernetes scheme
	scheme, err := helper.BuildScheme()
	if err != nil {
		logger.Error("failed to build Kubernetes scheme", "error", err)
		os.Exit(1)
	}

	// Create the controller manager
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

	// Create the request authenticator
	reqAuthN, err := auth.NewRequestAuthenticator(cfg.UserIdHeader, cfg.UserIdPrefix, cfg.GroupsHeader)
	if err != nil {
		logger.Error("failed to create request authenticator", "error", err)
		os.Exit(1)
	}

	// Create the request authorizer
	reqAuthZ, err := auth.NewRequestAuthorizer(mgr.GetConfig(), mgr.GetHTTPClient())
	if err != nil {
		logger.Error("failed to create request authorizer", "error", err)
	}

	// Create the application and server
	app, err := application.NewApp(cfg, logger, mgr.GetClient(), mgr.GetScheme(), reqAuthN, reqAuthZ)
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

	// Start the controller manager
	logger.Info("starting manager")
	if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
		logger.Error("problem running manager", "error", err)
		os.Exit(1)
	}
}

func getEnvAsInt(name string, defaultVal int) int {
	if value, exists := os.LookupEnv(name); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultVal
}

func getEnvAsFloat64(name string, defaultVal float64) float64 {
	if value, exists := os.LookupEnv(name); exists {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultVal
}

func getEnvAsStr(name string, defaultVal string) string {
	if value, exists := os.LookupEnv(name); exists {
		return value
	}
	return defaultVal
}

func getEnvAsBool(name string, defaultVal bool) bool {
	if value, exists := os.LookupEnv(name); exists {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultVal
}
