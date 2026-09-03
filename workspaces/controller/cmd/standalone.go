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
	return parseWorkspaceNetworkPolicy(cfg, f.networkPolicyPodSelector)
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
