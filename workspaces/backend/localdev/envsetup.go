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

package localdev

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	stdruntime "runtime"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
)

var (
	testEnv *envtest.Environment
)

// StartLocalDevEnvironment starts the envtest and the controllers
func StartLocalDevEnvironment(ctx context.Context, crdPaths []string,
	localScheme *runtime.Scheme) (*rest.Config, ctrl.Manager, *envtest.Environment, error) {
	setupLog := ctrl.Log.WithName("setup-localdev")

	projectRoot, err := getProjectRoot()
	if err != nil {
		setupLog.Error(err, "Failed to get project root")
		return nil, nil, nil, err
	}
	log.SetLogger(zap.New(zap.WriteTo(os.Stderr), zap.UseDevMode(true)))

	setupLog.Info("Setting up envtest environment...")

	testEnv = &envtest.Environment{
		CRDDirectoryPaths:     crdPaths,
		ErrorIfCRDPathMissing: true,
		BinaryAssetsDirectory: filepath.Join(projectRoot, "bin", "k8s",
			fmt.Sprintf("1.31.0-%s-%s", stdruntime.GOOS, stdruntime.GOARCH)),
	}

	// --- turning envtest on ---
	cfg, err := testEnv.Start()
	if err != nil {
		setupLog.Error(err, "Failed to start envtest")
		return nil, nil, testEnv, err
	}
	setupLog.Info("envtest started successfully")

	// ---  Manager creation ---
	// The Manager is the "brain" of controller-runtime.
	setupLog.Info("Creating controller-runtime manager")
	mgr, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme:         localScheme,
		LeaderElection: false,
	})
	if err != nil {
		setupLog.Error(err, "Failed to create manager")
		CleanUpEnvTest()
		return nil, nil, testEnv, err
	}

	// --- Creating resources (Namespace, WorkspaceKind, Workspace) ---
	if err := createInitialResources(ctx, mgr.GetClient()); err != nil {
		setupLog.Error(err, "Failed to create initial resources")
	} else {
		setupLog.Info("Initial resources created successfully")
	}

	setupLog.Info("Local development environment is ready!")
	return cfg, mgr, testEnv, nil
}

// CleanUpEnvTest stops the envtest.
func CleanUpEnvTest() {
	cleanupLog := ctrl.Log.WithName("envtest-cleanup") // Or pass logger from factory

	if testEnv != nil {
		cleanupLog.Info("Attempting to stop envtest control plane...")
		if err := testEnv.Stop(); err != nil {
			cleanupLog.Error(err, "Failed to stop envtest control plane")
		} else {
			cleanupLog.Info("Envtest control plane stopped successfully.")
		}
	} else {
		cleanupLog.Info("testEnv was nil, nothing to stop.")
	}
	ctrl.Log.Info("Local dev environment stopped.")
}

// getProjectRoot finds the project root directory by searching upwards from the currently
func getProjectRoot() (string, error) {
	_, currentFile, _, ok := stdruntime.Caller(0)
	if !ok {
		return "", errors.New("cannot get current file's path via runtime.Caller")
	}

	// Start searching from the directory containing this Go file.
	currentDir := filepath.Dir(currentFile)

	for {
		goModPath := filepath.Join(currentDir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			return currentDir, nil
		}

		parentDir := filepath.Dir(currentDir)
		if parentDir == currentDir {
			return "", errors.New("could not find project root containing go.mod")
		}
		currentDir = parentDir
	}
}
