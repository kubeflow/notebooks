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
			err := resolveRoutingConfig(cfg)
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
