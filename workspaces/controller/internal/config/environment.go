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
}

// Enabled reports whether generated routes should carry the ExternalAuth filter.
func (c ExternalAuthConfig) Enabled() bool {
	return c.BackendName != ""
}

type EnvConfig struct {
	RoutingProvider RoutingProviderType
	GatewayName     string
	GatewayHosts    string
	ExternalAuth    ExternalAuthConfig

	// Legacy Istio Configs (kept for backward compatibility)
	IstioGateway string
	IstioHosts   string
	UseIstio     bool

	ClusterDomain string
}
