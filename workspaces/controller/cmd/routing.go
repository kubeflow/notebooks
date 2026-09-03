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
	"strings"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

// routingFlags holds raw flag values that are resolved into the config
// after flag.Parse.
type routingFlags struct {
	networkPolicyIngress string
	networkPolicySelf    string
}

// registerRoutingFlags declares the flags that select how workspaces are
// published: through an Istio VirtualService or a Gateway API HTTPRoute.
// There is no routing "mode": these are properties of the one deployment, and
// installs differ only in what they set them to.
func registerRoutingFlags(cfg *config.EnvConfig) *routingFlags {
	f := &routingFlags{}
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
	flag.StringVar(&f.networkPolicyIngress, "workspace-network-policy-ingress",
		getEnvAsStr("WORKSPACE_NETWORK_POLICY_INGRESS", ""),
		"Routing layer allowed to reach workspace pods, as \"namespace\" or \"namespace:key=value,...\"; "+
			"empty generates no per-workspace NetworkPolicy")
	flag.StringVar(&f.networkPolicySelf, "workspace-network-policy-self",
		getEnvAsStr("WORKSPACE_NETWORK_POLICY_SELF", ""),
		"This controller's pods, in the same form, also allowed to reach workspace pods for the "+
			"activity probe; empty omits them, which breaks probing wherever NetworkPolicy is enforced")
	return f
}

// resolveRoutingConfig finalizes cfg from the raw flag values, after
// flag.Parse has run.
func resolveRoutingConfig(cfg *config.EnvConfig, f *routingFlags) error {
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

	return parseWorkspaceNetworkPolicy(cfg, f.networkPolicyIngress, f.networkPolicySelf)
}

// parseWorkspaceNetworkPolicy resolves the "namespace[:key=value,...]" peers
// allowed to reach workspace pods: the routing layer, and the controller itself.
func parseWorkspaceNetworkPolicy(cfg *config.EnvConfig, ingress, self string) error {
	if ingress == "" {
		return nil
	}

	namespace, podSelector, err := parseNetworkPolicyPeer(ingress)
	if err != nil {
		return fmt.Errorf("workspace network policy ingress: %w", err)
	}
	cfg.WorkspaceNetworkPolicy.IngressNamespace = namespace
	cfg.WorkspaceNetworkPolicy.IngressPodSelector = podSelector

	if self == "" {
		return nil
	}
	namespace, podSelector, err = parseNetworkPolicyPeer(self)
	if err != nil {
		return fmt.Errorf("workspace network policy self: %w", err)
	}
	cfg.WorkspaceNetworkPolicy.ControllerNamespace = namespace
	cfg.WorkspaceNetworkPolicy.ControllerPodSelector = podSelector
	return nil
}

func parseNetworkPolicyPeer(peer string) (string, map[string]string, error) {
	namespace, podSelector, _ := strings.Cut(peer, ":")
	if namespace == "" {
		return "", nil, fmt.Errorf("%q must name a namespace", peer)
	}
	if podSelector == "" {
		return namespace, nil, nil
	}
	selector, err := labels.ConvertSelectorToLabelsMap(podSelector)
	if err != nil {
		return "", nil, fmt.Errorf("parsing pod selector %q: %w", podSelector, err)
	}
	return namespace, selector, nil
}
