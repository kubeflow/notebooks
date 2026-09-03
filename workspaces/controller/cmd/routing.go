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

// registerRoutingFlags declares the flags that select how workspaces are
// published: through an Istio VirtualService or a Gateway API HTTPRoute.
// There is no routing "mode": these are properties of the one deployment, and
// installs differ only in what they set them to.
func registerRoutingFlags(cfg *config.EnvConfig) {
	flag.StringVar(&cfg.IstioGateway, "istio-gateway", getEnvAsStr("ISTIO_GATEWAY", ""),
		"The name of the Istio gateway to use")
	flag.StringVar(&cfg.IstioHosts, "istio-hosts", getEnvAsStr("ISTIO_HOSTS", "*"),
		"The hosts to use for the Istio VirtualService")
	flag.BoolVar(&cfg.UseIstio, "use-istio", getEnvAsBool("USE_ISTIO", false),
		"If set, Istio will be used")
	flag.StringVar(&cfg.GatewayName, "gateway-name", getEnvAsStr("GATEWAY_NAME", ""),
		"Gateway to publish workspace routes through, as \"namespace/name\"; setting it selects Gateway API routing")
	flag.StringVar(&cfg.GatewayHosts, "gateway-hosts", getEnvAsStr("GATEWAY_HOSTS", "*"),
		"The hosts to use for the Gateway API HTTPRoute")
}

// resolveRoutingConfig finalizes cfg from the raw flag values, after
// flag.Parse has run.
func resolveRoutingConfig(cfg *config.EnvConfig) error {
	// The routing provider is derived, not declared: pointing the controller
	// at a Gateway is what selects Gateway API routing.
	switch {
	case cfg.GatewayName != "" && cfg.UseIstio:
		return fmt.Errorf("gateway-name and use-istio are mutually exclusive")
	case cfg.GatewayName != "":
		cfg.RoutingProvider = config.RoutingProviderGatewayAPI
	case cfg.UseIstio:
		cfg.RoutingProvider = config.RoutingProviderIstio
	default:
		cfg.RoutingProvider = config.RoutingProviderNone
	}
	return nil
}
