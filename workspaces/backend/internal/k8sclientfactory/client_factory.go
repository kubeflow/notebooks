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

package k8sclientfactory

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-logr/logr"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"

	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/localdev"
)

// ClientFactory responsible for providing a Kubernetes client and manager
type ClientFactory struct {
	useEnvtest  bool
	crdPaths    []string
	logger      logr.Logger
	scheme      *runtime.Scheme
	clientQPS   float64
	clientBurst int
}

// NewClientFactory creates a new factory
func NewClientFactory(
	logger logr.Logger,
	scheme *runtime.Scheme,
	useEnvtest bool,
	crdPaths []string,
	appCfg *config.EnvConfig,
) *ClientFactory {
	return &ClientFactory{
		useEnvtest:  useEnvtest,
		crdPaths:    crdPaths,
		logger:      logger.WithName("k8s-client-factory"),
		scheme:      scheme,
		clientQPS:   appCfg.ClientQPS,
		clientBurst: appCfg.ClientBurst,
	}
}

// GetManagerAndConfig returns a configured Kubernetes manager and its rest.Config
// It also returns a cleanup function for envtest if it was started.
func (f *ClientFactory) GetManagerAndConfig(ctx context.Context) (ctrl.Manager, *rest.Config, func(), error) {
	var mgr ctrl.Manager
	var cfg *rest.Config
	var err error
	var cleanupFunc func() = func() {} // No-op cleanup by default

	if f.useEnvtest {
		f.logger.Info("Using envtest mode: setting up local Kubernetes environment...")
		var testEnvInstance *envtest.Environment

		cfg, mgr, testEnvInstance, err = localdev.StartLocalDevEnvironment(ctx, f.crdPaths, f.scheme)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("could not start local dev environment: %w", err)
		}
		f.logger.Info("Local dev K8s API (envtest) is ready.", "host", cfg.Host)

		if testEnvInstance != nil {
			cleanupFunc = func() {
				f.logger.Info("Stopping envtest environment...")
				if err := testEnvInstance.Stop(); err != nil {
					f.logger.Error(err, "Failed to stop envtest environment")
				}
			}
		} else {
			err = errors.New("StartLocalDevEnvironment returned successfully but with a nil testEnv instance, cleanup is not possible")
			f.logger.Error(err, "invalid return state from localdev setup")
			return nil, nil, nil, err
		}
	} else {
		f.logger.Info("Using real cluster mode: connecting to existing Kubernetes cluster...")
		cfg, err = ctrl.GetConfig()
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to get Kubernetes config: %w", err)
		}
		f.logger.Info("Successfully connected to existing Kubernetes cluster.")

		cfg.QPS = float32(f.clientQPS)
		cfg.Burst = f.clientBurst
		mgr, err = ctrl.NewManager(cfg, ctrl.Options{
			Scheme: f.scheme,
			Metrics: metricsserver.Options{
				BindAddress: "0", // disable metrics serving
			},
			HealthProbeBindAddress: "0", // disable health probe serving
			LeaderElection:         false,
		})
		if err != nil {
			return nil, nil, nil, fmt.Errorf("unable to create manager for real cluster: %w", err)
		}
		f.logger.Info("Successfully configured manager for existing Kubernetes cluster.")
	}
	return mgr, cfg, cleanupFunc, nil
}

// GetClient returns just the client.Client (useful if manager lifecycle is handled elsewhere or already started)
func (f *ClientFactory) GetClient(ctx context.Context) (client.Client, func(), error) {
	mgr, _, cleanup, err := f.GetManagerAndConfig(ctx)
	if err != nil {
		if cleanup != nil {
			f.logger.Info("Calling cleanup function due to error during manager/config retrieval", "error", err)
			cleanup()
		}
		return nil, cleanup, err
	}
	return mgr.GetClient(), cleanup, nil
}
