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

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

// standaloneFlags holds raw flag values that are resolved into the config
// after flag.Parse.
type standaloneFlags struct {
	routingProvider          string
	externalAuthBackendPort  int
	externalAuthProtocol     string
	networkPolicyPodSelector string
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
	flag.StringVar(&cfg.ExternalAuth.BackendName, "external-auth-backend-name",
		getEnvAsStr("EXTERNAL_AUTH_BACKEND_NAME", ""),
		"Name of the Service implementing external authorization; if empty, generated routes carry no ExternalAuth filter")
	flag.StringVar(&cfg.ExternalAuth.BackendNamespace, "external-auth-backend-namespace",
		getEnvAsStr("EXTERNAL_AUTH_BACKEND_NAMESPACE", ""),
		"Namespace of the external authorization Service; needs a ReferenceGrant when it is not the workspace namespace")
	flag.IntVar(&f.externalAuthBackendPort, "external-auth-backend-port",
		getEnvAsInt("EXTERNAL_AUTH_BACKEND_PORT", 9001),
		"Port of the external authorization Service")
	flag.StringVar(&f.externalAuthProtocol, "external-auth-protocol",
		getEnvAsStr("EXTERNAL_AUTH_PROTOCOL", string(config.ExternalAuthProtocolGRPC)),
		"Protocol used to call the external authorization Service (GRPC or HTTP)")
	flag.StringVar(&cfg.ExternalAuth.HTTPPath, "external-auth-http-path",
		getEnvAsStr("EXTERNAL_AUTH_HTTP_PATH", ""),
		"Path prefix prepended when calling an HTTP external authorization Service")
	flag.BoolVar(&cfg.WorkspaceNetworkPolicy.Enabled, "workspace-network-policy",
		getEnvAsBool("WORKSPACE_NETWORK_POLICY", false),
		"If set, generate a NetworkPolicy per workspace restricting ingress to the routing layer")
	flag.StringVar(&cfg.WorkspaceNetworkPolicy.IngressNamespace, "workspace-network-policy-ingress-namespace",
		getEnvAsStr("WORKSPACE_NETWORK_POLICY_INGRESS_NAMESPACE", ""),
		"Namespace of the routing layer allowed to reach workspace pods")
	flag.StringVar(&f.networkPolicyPodSelector, "workspace-network-policy-ingress-pod-selector",
		getEnvAsStr("WORKSPACE_NETWORK_POLICY_INGRESS_POD_SELECTOR", ""),
		"Comma separated key=value labels of the routing layer pods; empty allows the whole ingress namespace")
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
	cfg.ExternalAuth.BackendPort = int32(f.externalAuthBackendPort) //nolint:gosec // bounded by validateExternalAuth
	cfg.ExternalAuth.Protocol = config.ExternalAuthProtocolType(f.externalAuthProtocol)

	if err := validateExternalAuth(cfg); err != nil {
		return err
	}
	return parseWorkspaceNetworkPolicy(cfg, f.networkPolicyPodSelector)
}

// validateExternalAuth rejects a partial or nonsensical external authorization
// setup at startup, rather than emitting HTTPRoutes the data plane will refuse.
func validateExternalAuth(cfg *config.EnvConfig) error {
	if !cfg.ExternalAuth.Enabled() {
		return nil
	}

	if cfg.RoutingProvider != config.RoutingProviderGatewayAPI {
		return fmt.Errorf("external authorization requires the %q routing provider, got %q",
			config.RoutingProviderGatewayAPI, cfg.RoutingProvider)
	}
	if cfg.ExternalAuth.BackendPort < 1 || cfg.ExternalAuth.BackendPort > 65535 {
		return fmt.Errorf("external authorization backend port %d is out of range", cfg.ExternalAuth.BackendPort)
	}
	switch cfg.ExternalAuth.Protocol {
	case config.ExternalAuthProtocolGRPC, config.ExternalAuthProtocolHTTP:
	default:
		return fmt.Errorf("external authorization protocol must be %q or %q, got %q",
			config.ExternalAuthProtocolGRPC, config.ExternalAuthProtocolHTTP, cfg.ExternalAuth.Protocol)
	}

	return nil
}

// parseWorkspaceNetworkPolicy resolves the pod selector and rejects a policy
// that would be generated without a source, which would make every workspace
// unreachable.
func parseWorkspaceNetworkPolicy(cfg *config.EnvConfig, podSelector string) error {
	if !cfg.WorkspaceNetworkPolicy.Enabled {
		return nil
	}

	if cfg.WorkspaceNetworkPolicy.IngressNamespace == "" {
		return fmt.Errorf("workspace network policies require an ingress namespace")
	}

	if podSelector != "" {
		selector, err := labels.ConvertSelectorToLabelsMap(podSelector)
		if err != nil {
			return fmt.Errorf("parsing ingress pod selector %q: %w", podSelector, err)
		}
		cfg.WorkspaceNetworkPolicy.IngressPodSelector = selector
	}

	return nil
}
