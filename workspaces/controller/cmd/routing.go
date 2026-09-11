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
	"net/url"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

// routingFlags holds raw flag values that are resolved into the config
// after flag.Parse.
type routingFlags struct {
	externalAuthURL             string
	externalAuthRequestHeaders  string
	externalAuthResponseHeaders string
	networkPolicyIngress        string
	networkPolicySelf           string
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
	flag.StringVar(&f.externalAuthURL, "external-auth-url", getEnvAsStr("EXTERNAL_AUTH_URL", ""),
		"External authorization service guarding workspace routes, e.g. "+
			"\"http://workspaces-backend.kubeflow-workspaces:4000/authz\": the scheme selects the protocol "+
			"(http or grpc), the host names a Service as <name>.<namespace>, and the path is prepended to "+
			"HTTP checks. Empty emits routes with no ExternalAuth filter.")
	flag.StringVar(&f.externalAuthRequestHeaders, "external-auth-request-headers",
		getEnvAsStr("EXTERNAL_AUTH_REQUEST_HEADERS", ""),
		"Comma-separated client request headers sent to the authorization service on top of Host, "+
			"Method, Path, Content-Length and Authorization; cookie-based sessions need \"Cookie\"")
	flag.StringVar(&f.externalAuthResponseHeaders, "external-auth-response-headers",
		getEnvAsStr("EXTERNAL_AUTH_RESPONSE_HEADERS", ""),
		"Comma-separated authorization response headers copied onto the request forwarded to the "+
			"workspace, e.g. \"kubeflow-userid,kubeflow-groups\"; empty leaves it to the implementation")
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

	if err := parseExternalAuthURL(cfg, f.externalAuthURL); err != nil {
		return err
	}
	if err := parseExternalAuthHeaders(cfg, f.externalAuthRequestHeaders, f.externalAuthResponseHeaders); err != nil {
		return err
	}
	return parseWorkspaceNetworkPolicy(cfg, f.networkPolicyIngress, f.networkPolicySelf)
}

// parseExternalAuthURL resolves the external authorization URL into the
// backendRef fields of the ExternalAuth filter (GEP-1494), rejecting a URL the
// data plane could not act on at startup rather than emitting broken routes.
func parseExternalAuthURL(cfg *config.EnvConfig, rawURL string) error {
	if rawURL == "" {
		return nil
	}
	if cfg.RoutingProvider != config.RoutingProviderGatewayAPI {
		return fmt.Errorf("external authorization requires Gateway API routing: set gateway-name")
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("parsing external auth URL %q: %w", rawURL, err)
	}

	switch u.Scheme {
	case "http":
		cfg.ExternalAuth.Protocol = config.ExternalAuthProtocolHTTP
		cfg.ExternalAuth.HTTPPath = strings.TrimSuffix(u.Path, "/")
	case "grpc":
		cfg.ExternalAuth.Protocol = config.ExternalAuthProtocolGRPC
		if u.Path != "" && u.Path != "/" {
			return fmt.Errorf("external auth URL %q: a grpc check carries no path", rawURL)
		}
	default:
		return fmt.Errorf("external auth URL %q: scheme must be http or grpc", rawURL)
	}

	port, err := strconv.Atoi(u.Port())
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("external auth URL %q must carry an explicit port", rawURL)
	}
	cfg.ExternalAuth.BackendPort = int32(port) //nolint:gosec // range-checked above

	// The host names a Service as <name>.<namespace>, tolerating a
	// fully-qualified in-cluster DNS name. A bare name would resolve relative
	// to each workspace namespace, silently pointing every route at a
	// different (likely nonexistent) authorizer.
	host := strings.TrimSuffix(u.Hostname(), "."+cfg.ClusterDomain)
	host = strings.TrimSuffix(host, ".svc")
	name, namespace, found := strings.Cut(host, ".")
	if !found || name == "" || namespace == "" || strings.Contains(namespace, ".") {
		return fmt.Errorf("external auth URL %q: host must be <service>.<namespace>", rawURL)
	}
	cfg.ExternalAuth.BackendName = name
	cfg.ExternalAuth.BackendNamespace = namespace

	return nil
}

// parseExternalAuthHeaders resolves the comma-separated header lists of the
// ExternalAuth filter. They only mean something alongside an authorization
// service, so setting them without one is treated as a misconfiguration.
func parseExternalAuthHeaders(cfg *config.EnvConfig, request, response string) error {
	if request == "" && response == "" {
		return nil
	}
	if !cfg.ExternalAuth.Enabled() {
		return fmt.Errorf("external auth headers require external-auth-url")
	}

	var err error
	if cfg.ExternalAuth.RequestHeaders, err = parseHeaderList(request); err != nil {
		return fmt.Errorf("external auth request headers: %w", err)
	}
	if cfg.ExternalAuth.ResponseHeaders, err = parseHeaderList(response); err != nil {
		return fmt.Errorf("external auth response headers: %w", err)
	}
	return nil
}

// parseHeaderList splits a comma-separated list of header names, rejecting
// what the HTTPRoute would: header names are a set, compared case-insensitively.
func parseHeaderList(raw string) ([]string, error) {
	var headers []string
	seen := map[string]bool{}
	for name := range strings.SplitSeq(raw, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if seen[key] {
			return nil, fmt.Errorf("%q listed more than once", name)
		}
		seen[key] = true
		headers = append(headers, name)
	}
	return headers, nil
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
