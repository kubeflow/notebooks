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

package config

// RoutingProviderType selects which API the controller uses to publish
// workspace routes. It is derived from the deployment's configuration —
// gateway-name selects Gateway API, use-istio selects Istio — never declared
// directly.
type RoutingProviderType string

const (
	RoutingProviderNone       RoutingProviderType = "none"
	RoutingProviderIstio      RoutingProviderType = "istio"
	RoutingProviderGatewayAPI RoutingProviderType = "gateway-api"
)

// ExternalAuthProtocolType is the protocol the Gateway API ExternalAuth filter
// uses to talk to the authorization service.
type ExternalAuthProtocolType string

const (
	ExternalAuthProtocolGRPC ExternalAuthProtocolType = "GRPC"
	ExternalAuthProtocolHTTP ExternalAuthProtocolType = "HTTP"
)

// ExternalAuthConfig points generated HTTPRoutes at an external authorization
// service, using the ExternalAuth filter from GEP-1494.
//
// Workspace routes are proxied straight to a notebook pod, so without this
// filter nothing authenticates or authorizes a request before it reaches the
// workspace. An empty BackendName disables the filter.
type ExternalAuthConfig struct {
	BackendName      string
	BackendNamespace string
	BackendPort      int32
	Protocol         ExternalAuthProtocolType

	// HTTPPath is the prefix the data plane prepends to the request path when
	// calling an HTTP authorization service. Ignored for GRPC.
	HTTPPath string

	// RequestHeaders lists the client request headers sent to the
	// authorization service on top of the ones GEP-1494 always sends (Host,
	// Method, Path, Content-Length, Authorization). A session cookie is not
	// among those, so cookie-based authentication needs "Cookie" here.
	RequestHeaders []string

	// ResponseHeaders lists the authorization response headers copied onto the
	// request forwarded to the workspace, such as the verified identity.
	// GEP-1494 copies every header when this is empty, but not every
	// implementation does, so listing them is what makes the behavior
	// portable. Ignored for GRPC.
	ResponseHeaders []string
}

// Enabled reports whether generated routes should carry the ExternalAuth filter.
func (c *ExternalAuthConfig) Enabled() bool {
	return c.BackendName != ""
}

// WorkspaceNetworkPolicyConfig restricts which pods may reach a workspace pod.
//
// Workspace pods serve an unauthenticated notebook, so without this any pod in
// the cluster can reach them directly, bypassing the routing layer and whatever
// authentication runs there. In an Istio deployment this is covered by the
// per-namespace AuthorizationPolicy that the Kubeflow Profile controller
// creates; there is no equivalent otherwise.
type WorkspaceNetworkPolicyConfig struct {
	// IngressNamespace and IngressPodSelector identify the routing layer pods
	// allowed to reach workspace pods. An empty IngressPodSelector allows the
	// whole IngressNamespace.
	IngressNamespace   string
	IngressPodSelector map[string]string

	// ControllerNamespace and ControllerPodSelector identify this controller's
	// own pods, which must also reach workspace pods for the activity probe.
	// An empty ControllerNamespace omits the peer.
	ControllerNamespace   string
	ControllerPodSelector map[string]string
}

// Enabled reports whether a NetworkPolicy is generated per workspace.
func (c WorkspaceNetworkPolicyConfig) Enabled() bool {
	return c.IngressNamespace != ""
}
