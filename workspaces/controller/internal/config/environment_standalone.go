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
// workspace routes. The default is "none"; Istio deployments may keep using
// the legacy UseIstio flag instead.
type RoutingProviderType string

const (
	RoutingProviderNone       RoutingProviderType = "none"
	RoutingProviderIstio      RoutingProviderType = "istio"
	RoutingProviderGatewayAPI RoutingProviderType = "gateway-api"
)

// WorkspaceNetworkPolicyConfig restricts which pods may reach a workspace pod.
//
// Workspace pods serve an unauthenticated notebook, so without this any pod in
// the cluster can reach them directly, bypassing the routing layer and whatever
// authentication runs there. In an Istio deployment this is covered by the
// per-namespace AuthorizationPolicy that the Kubeflow Profile controller
// creates; there is no equivalent otherwise.
type WorkspaceNetworkPolicyConfig struct {
	Enabled bool

	// IngressNamespace and IngressPodSelector identify the routing layer pods
	// allowed to reach workspace pods. An empty IngressPodSelector allows the
	// whole IngressNamespace.
	IngressNamespace   string
	IngressPodSelector map[string]string
}
