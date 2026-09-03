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

	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

// standaloneFlags holds raw flag values that are resolved into the config
// after flag.Parse.
type standaloneFlags struct {
	routingProvider string
}

// registerStandaloneFlags declares the flags for running Kubeflow Notebooks as
// a standalone product: routing provider selection, Gateway API routing,
// external authorization, and per-workspace network policies.
func registerStandaloneFlags(cfg *config.EnvConfig) *standaloneFlags {
	f := &standaloneFlags{}
	flag.StringVar(&f.routingProvider, "routing-provider",
		getEnvAsStr("ROUTING_PROVIDER", string(config.RoutingProviderNone)),
		"The routing provider to use (none, istio, gateway-api)")
	flag.StringVar(&cfg.GatewayName, "gateway-name", getEnvAsStr("GATEWAY_NAME", ""),
		"The name of the Gateway API Gateway to use")
	flag.StringVar(&cfg.GatewayHosts, "gateway-hosts", getEnvAsStr("GATEWAY_HOSTS", "*"),
		"The hosts to use for the Gateway API HTTPRoute")
	return f
}

// resolveStandaloneConfig finalizes cfg from the raw flag values, after
// flag.Parse has run.
func resolveStandaloneConfig(cfg *config.EnvConfig, f *standaloneFlags) error {
	cfg.RoutingProvider = config.RoutingProviderType(f.routingProvider)
	switch cfg.RoutingProvider {
	case config.RoutingProviderNone, config.RoutingProviderIstio, config.RoutingProviderGatewayAPI:
	default:
		return fmt.Errorf("routing provider must be %q, %q or %q, got %q",
			config.RoutingProviderNone, config.RoutingProviderIstio, config.RoutingProviderGatewayAPI, f.routingProvider)
	}
	return nil
}
