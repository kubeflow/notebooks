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
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	stdruntime "runtime"
	"strconv"

	"github.com/go-logr/logr"

	ctrl "sigs.k8s.io/controller-runtime"

	application "github.com/kubeflow/notebooks/workspaces/backend/api"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/k8sclientfactory"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/server"
)

//	@title			Kubeflow Notebooks API
//	@version		1.0.0
//	@description	This API provides endpoints to manage notebooks in a Kubernetes cluster.
//	@description	For more information, visit https://www.kubeflow.org/docs/components/notebooks/

//	@license.name	Apache 2.0
//	@license.url	http://www.apache.org/licenses/LICENSE-2.0.html

//	@host		localhost:4000
//	@BasePath	/api/v1

//	@schemes	http https
//	@consumes	application/json
//	@produces	application/json

func run() error {
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

	var enableEnvTest bool
	flag.BoolVar(&enableEnvTest,
		"enable-envtest",
		getEnvAsBool("ENABLE_ENVTEST", false),
		"Enable envtest for local development without a real k8s cluster",
	)
	flag.Parse()

	// Initialize the logger
	slogTextHandler := slog.NewTextHandler(os.Stdout, nil)
	logger := slog.New(slogTextHandler)

	// Build the Kubernetes scheme
	scheme, err := helper.BuildScheme()
	if err != nil {
		logger.Error("failed to build Kubernetes scheme", "error", err)
		return err
	}

	// Defining CRD's path
	crdPath := os.Getenv("CRD_PATH")
	if crdPath == "" {
		_, currentFile, _, ok := stdruntime.Caller(0)
		if !ok {
			logger.Info("Failed to get current file path using stdruntime.Caller")
		}
		testFileDir := filepath.Dir(currentFile)
		crdPath = filepath.Join(testFileDir, "..", "..", "controller", "config", "crd", "bases")
		logger.Info("CRD_PATH not set, using guessed default", "path", crdPath)
	}

	// ctx creates a context that listens for OS signals (e.g., SIGINT, SIGTERM) for graceful shutdown.
	ctx := ctrl.SetupSignalHandler()

	logrlogger := logr.FromSlogHandler(slogTextHandler)

	// factory creates a new Kubernetes client factory, configured for envtest if enabled.
	factory := k8sclientfactory.NewClientFactory(logrlogger, scheme, enableEnvTest, []string{crdPath}, cfg)

	// Create the controller manager, build Kubernetes client configuration
	// envtestCleanupFunc is a function to clean envtest if it was created, otherwise it's an empty function.
	mgr, _, envtestCleanupFunc, err := factory.GetManagerAndConfig(ctx)
	defer envtestCleanupFunc()
	if err != nil {
		logger.Error("Failed to get Kubernetes manager/config from factory", "error", err)
		return err
	}

	// Create the request authenticator
	reqAuthN, err := auth.NewRequestAuthenticator(cfg.UserIdHeader, cfg.UserIdPrefix, cfg.GroupsHeader)
	if err != nil {
		logger.Error("failed to create request authenticator", "error", err)
		return err
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
		return err
	}
	svr, err := server.NewServer(app, logger)
	if err != nil {
		logger.Error("failed to create server", "error", err)
		return err
	}
	if err := svr.SetupWithManager(mgr); err != nil {
		logger.Error("failed to setup server with manager", "error", err)
		return err
	}

	logger.Info("Starting manager...")
	if err := mgr.Start(ctx); err != nil {
		logger.Error("Problem running manager", "error", err)
		return err
	}

	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Application run failed: %v\n", err)
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
