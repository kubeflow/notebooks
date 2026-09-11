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
	"reflect"
	"testing"

	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

func TestResolveRoutingConfigDerivesRoutingProvider(t *testing.T) {
	tests := []struct {
		name         string
		gatewayName  string
		useIstio     bool
		wantProvider config.RoutingProviderType
		wantErr      bool
	}{
		{name: "no routing", wantProvider: config.RoutingProviderNone},
		{
			name: "gateway selects gateway-api", gatewayName: "kubeflow/kubeflow-gateway",
			wantProvider: config.RoutingProviderGatewayAPI,
		},
		{name: "use-istio selects istio", useIstio: true, wantProvider: config.RoutingProviderIstio},
		{name: "both is rejected", gatewayName: "kubeflow/kubeflow-gateway", useIstio: true, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.EnvConfig{GatewayName: tt.gatewayName, UseIstio: tt.useIstio}
			err := resolveRoutingConfig(cfg, &routingFlags{})
			if tt.wantErr {
				if err == nil {
					t.Fatal("resolveRoutingConfig accepted a Gateway and Istio at once")
				}
				return
			}
			if err != nil {
				t.Fatalf("resolveRoutingConfig returned unexpected error: %v", err)
			}
			if cfg.RoutingProvider != tt.wantProvider {
				t.Errorf("RoutingProvider = %q, want %q", cfg.RoutingProvider, tt.wantProvider)
			}
		})
	}
}

func TestParseExternalAuthURL(t *testing.T) {
	tests := []struct {
		name    string
		rawURL  string
		want    config.ExternalAuthConfig
		wantErr bool
	}{
		{
			name:   "http URL with path",
			rawURL: "http://workspaces-backend.kubeflow-workspaces:4000/authz",
			want: config.ExternalAuthConfig{
				BackendName:      "workspaces-backend",
				BackendNamespace: "kubeflow-workspaces",
				BackendPort:      4000,
				Protocol:         config.ExternalAuthProtocolHTTP,
				HTTPPath:         "/authz",
			},
		},
		{
			name:   "fully qualified in-cluster name",
			rawURL: "http://workspaces-backend.kubeflow-workspaces.svc.cluster.local:4000/authz",
			want: config.ExternalAuthConfig{
				BackendName:      "workspaces-backend",
				BackendNamespace: "kubeflow-workspaces",
				BackendPort:      4000,
				Protocol:         config.ExternalAuthProtocolHTTP,
				HTTPPath:         "/authz",
			},
		},
		{
			name:   "grpc URL",
			rawURL: "grpc://authz.kubeflow:9000",
			want: config.ExternalAuthConfig{
				BackendName:      "authz",
				BackendNamespace: "kubeflow",
				BackendPort:      9000,
				Protocol:         config.ExternalAuthProtocolGRPC,
			},
		},
		{name: "grpc with path", rawURL: "grpc://authz.kubeflow:9000/authz", wantErr: true},
		{name: "missing port", rawURL: "http://workspaces-backend.kubeflow-workspaces/authz", wantErr: true},
		{name: "bare service name", rawURL: "http://workspaces-backend:4000/authz", wantErr: true},
		{name: "unknown scheme", rawURL: "https://workspaces-backend.kubeflow-workspaces:4000/authz", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.EnvConfig{
				RoutingProvider: config.RoutingProviderGatewayAPI,
				ClusterDomain:   "cluster.local",
			}
			err := parseExternalAuthURL(cfg, tt.rawURL)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("parseExternalAuthURL(%q) accepted an invalid URL", tt.rawURL)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseExternalAuthURL(%q) returned unexpected error: %v", tt.rawURL, err)
			}
			if !reflect.DeepEqual(cfg.ExternalAuth, tt.want) {
				t.Errorf("ExternalAuth = %+v, want %+v", cfg.ExternalAuth, tt.want)
			}
		})
	}
}

func TestParseExternalAuthHeaders(t *testing.T) {
	enabled := func() *config.EnvConfig {
		return &config.EnvConfig{ExternalAuth: config.ExternalAuthConfig{BackendName: "workspaces-backend"}}
	}

	cfg := enabled()
	if err := parseExternalAuthHeaders(cfg, " Cookie ", "kubeflow-userid, kubeflow-groups,"); err != nil {
		t.Fatalf("parseExternalAuthHeaders returned unexpected error: %v", err)
	}
	if !reflect.DeepEqual(cfg.ExternalAuth.RequestHeaders, []string{"Cookie"}) {
		t.Errorf("RequestHeaders = %q, want [Cookie]", cfg.ExternalAuth.RequestHeaders)
	}
	if !reflect.DeepEqual(cfg.ExternalAuth.ResponseHeaders, []string{"kubeflow-userid", "kubeflow-groups"}) {
		t.Errorf("ResponseHeaders = %q, want [kubeflow-userid kubeflow-groups]", cfg.ExternalAuth.ResponseHeaders)
	}

	cfg = enabled()
	if err := parseExternalAuthHeaders(cfg, "", ""); err != nil || cfg.ExternalAuth.RequestHeaders != nil {
		t.Errorf("empty lists: err=%v RequestHeaders=%q, want none", err, cfg.ExternalAuth.RequestHeaders)
	}

	// Header names are a set on the HTTPRoute; catch it before emitting routes
	// the API server would reject.
	if err := parseExternalAuthHeaders(enabled(), "Cookie,cookie", ""); err == nil {
		t.Error("parseExternalAuthHeaders accepted a header listed twice")
	}

	if err := parseExternalAuthHeaders(&config.EnvConfig{}, "Cookie", ""); err == nil {
		t.Error("parseExternalAuthHeaders accepted headers without an authorization service")
	}
}

func TestParseExternalAuthURLRequiresGateway(t *testing.T) {
	cfg := &config.EnvConfig{RoutingProvider: config.RoutingProviderIstio}
	if err := parseExternalAuthURL(cfg, "http://workspaces-backend.kubeflow-workspaces:4000/authz"); err == nil {
		t.Fatal("parseExternalAuthURL accepted external auth without Gateway API routing")
	}
}

func TestParseWorkspaceNetworkPolicy(t *testing.T) {
	cfg := &config.EnvConfig{}
	if err := parseWorkspaceNetworkPolicy(cfg, "", ""); err != nil || cfg.WorkspaceNetworkPolicy.Enabled() {
		t.Fatalf("empty ingress: err=%v enabled=%v, want disabled", err, cfg.WorkspaceNetworkPolicy.Enabled())
	}

	cfg = &config.EnvConfig{}
	err := parseWorkspaceNetworkPolicy(cfg,
		"kubeflow:gateway.networking.k8s.io/gateway-name=kubeflow-gateway",
		"kubeflow-workspaces:app=workspaces-controller")
	if err != nil {
		t.Fatalf("parseWorkspaceNetworkPolicy returned unexpected error: %v", err)
	}
	if !cfg.WorkspaceNetworkPolicy.Enabled() || cfg.WorkspaceNetworkPolicy.IngressNamespace != "kubeflow" {
		t.Errorf("IngressNamespace = %q, want kubeflow", cfg.WorkspaceNetworkPolicy.IngressNamespace)
	}
	got := cfg.WorkspaceNetworkPolicy.IngressPodSelector["gateway.networking.k8s.io/gateway-name"]
	if got != "kubeflow-gateway" {
		t.Errorf("IngressPodSelector = %v, want gateway-name=kubeflow-gateway",
			cfg.WorkspaceNetworkPolicy.IngressPodSelector)
	}
	if cfg.WorkspaceNetworkPolicy.ControllerNamespace != "kubeflow-workspaces" ||
		cfg.WorkspaceNetworkPolicy.ControllerPodSelector["app"] != "workspaces-controller" {
		t.Errorf("controller peer = %q %v, want kubeflow-workspaces app=workspaces-controller",
			cfg.WorkspaceNetworkPolicy.ControllerNamespace, cfg.WorkspaceNetworkPolicy.ControllerPodSelector)
	}

	cfg = &config.EnvConfig{}
	if err := parseWorkspaceNetworkPolicy(cfg, ":key=value", ""); err == nil {
		t.Error("parseWorkspaceNetworkPolicy accepted an empty ingress namespace")
	}
	cfg = &config.EnvConfig{}
	if err := parseWorkspaceNetworkPolicy(cfg, "kubeflow", ":app=x"); err == nil {
		t.Error("parseWorkspaceNetworkPolicy accepted an empty controller namespace")
	}
}
