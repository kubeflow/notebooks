.PHONY: check-tilt tilt-up tilt-down setup-kind setup-cert-manager setup-istio setup-prometheus setup-metrics-server setup-gateway-api kustomize istioctl cloud-provider-kind

# Variables
CLUSTER_NAME := tilt
KIND_CONTEXT := kind-$(CLUSTER_NAME)

# Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

# Tool Binaries
KUSTOMIZE ?= $(LOCALBIN)/kustomize
ISTIOCTL ?= $(LOCALBIN)/istioctl
CLOUD_PROVIDER_KIND ?= $(LOCALBIN)/cloud-provider-kind

# Tool Versions
KUSTOMIZE_VERSION ?= v5.5.0
ISTIOCTL_VERSION ?= 1.29.1
CLOUD_PROVIDER_KIND_VERSION ?= latest

# Export KIND_EXPERIMENTAL_PROVIDER to honor it if set in user's environment
# (e.g., KIND_EXPERIMENTAL_PROVIDER=podman for podman support)
export KIND_EXPERIMENTAL_PROVIDER

# Check if tilt is installed
.PHONY: check-tilt
check-tilt:
	@if ! command -v tilt >/dev/null 2>&1; then \
		echo "ERROR: tilt is not installed. Please install tilt first:"; \
		echo "  curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash"; \
		echo "  or visit: https://docs.tilt.dev/install.html"; \
		exit 1; \
	fi

# Ensure kind cluster exists and context is set before running tilt
.PHONY: setup-kind
setup-kind:
	@echo "Setting up Kind cluster..."
	@if [ -n "$$KIND_EXPERIMENTAL_PROVIDER" ]; then \
		echo "Using KIND_EXPERIMENTAL_PROVIDER=$$KIND_EXPERIMENTAL_PROVIDER"; \
	fi
	@export PATH="$(LOCALBIN):$$PATH" && ./scripts/setup-kind.sh

# Install cert-manager (depends on kind cluster being set up)
.PHONY: setup-cert-manager
setup-cert-manager:
	@echo "Setting up cert-manager..."
	@export PATH="$(LOCALBIN):$$PATH" && ./scripts/setup-cert-manager.sh

# Install Istio and gateway resources (depends on cert-manager for TLS certificates)
.PHONY: setup-istio
setup-istio: setup-cert-manager
	@echo "Setting up Istio..."
	@export PATH="$(LOCALBIN):$$PATH" && ./scripts/setup-istio.sh

# Install Prometheus for metrics verification (optional, depends on kind cluster)
.PHONY: setup-prometheus
setup-prometheus:
	@echo "Setting up Prometheus..."
	@export PATH="$(LOCALBIN):$$PATH" && ./scripts/setup-prometheus.sh

# Install metrics-server for `kubectl top` verification (optional, gated by ENABLE_METRICS_SERVER)
.PHONY: setup-metrics-server
setup-metrics-server:
	@echo "Setting up metrics-server..."
	@export PATH="$(LOCALBIN):$$PATH" && ./scripts/setup-metrics-server.sh

# Setup cloud-provider-kind
setup-cloud-provider-kind: cloud-provider-kind setup-kind
	@echo "Setting up cloud-provider-kind..."
	@./scripts/setup-cloud-provider-kind.sh

# Install Gateway API and a gateway controller
setup-gateway-api: setup-cert-manager setup-cloud-provider-kind
	@echo "Setting up Gateway API..."
	@./scripts/setup-gateway-api.sh

# Install Gateway API with the experimental channel, required by the ExternalAuth filter
.PHONY: setup-gateway-api-experimental
setup-gateway-api-experimental: setup-cert-manager setup-cloud-provider-kind
	@echo "Setting up Gateway API (experimental channel)..."
	@GATEWAY_API_CHANNEL=experimental ./scripts/setup-gateway-api.sh

# Generate the secrets and host wiring the authorization service needs
.PHONY: setup-ext-authz
setup-ext-authz:
	@echo "Setting up external authorization..."
	@./scripts/setup-ext-authz.sh

# Run tilt up with kind cluster, cert-manager, and Istio setup
.PHONY: tilt-up
tilt-up: kustomize check-tilt setup-kind setup-istio setup-prometheus setup-metrics-server
	@echo "Starting Tilt..."
	@tilt up

# Run tilt up with Gateway API flavor
.PHONY: tilt-up-gateway-api
tilt-up-gateway-api: check-tilt setup-gateway-api kustomize
	@echo "Starting Tilt (Gateway API flavor)..."
	@ROUTING_PROVIDER=gateway-api tilt up

# Run tilt up with Gateway API and external authorization.
#
# The authorization service secrets and host alias are created by
# `make setup-ext-authz`, which has to run after Tilt has applied the Gateway
# and the authz Deployment.
.PHONY: tilt-up-gateway-api-ext-authz
tilt-up-gateway-api-ext-authz: check-tilt setup-gateway-api-experimental kustomize
	@echo "Starting Tilt (Gateway API + external authorization flavor)..."
	@ROUTING_PROVIDER=gateway-api ENABLE_EXT_AUTHZ=true tilt up

# Run Gateway API e2e tests
test-e2e-gateway-api: setup-gateway-api
	@echo "Running Gateway API e2e tests..."
	@./scripts/test-e2e-gateway-api.sh

# Stop Tilt
.PHONY: tilt-down
tilt-down: check-tilt kustomize
	@echo "Stopping Tilt..."
	@tilt down

# Install kustomize
.PHONY: kustomize
kustomize: $(KUSTOMIZE)
$(KUSTOMIZE): $(LOCALBIN)
	$(call go-install-tool,$(KUSTOMIZE),sigs.k8s.io/kustomize/kustomize/v5,$(KUSTOMIZE_VERSION))

# Install istioctl
istioctl: $(ISTIOCTL)
$(ISTIOCTL): $(LOCALBIN)
	$(call go-install-tool,$(ISTIOCTL),istio.io/istio/istioctl/cmd/istioctl,$(ISTIOCTL_VERSION),"-X istio.io/istio/pkg/version.buildVersion=$(ISTIOCTL_VERSION) -X istio.io/istio/pkg/version.buildTag=$(ISTIOCTL_VERSION) -X istio.io/istio/pkg/version.buildHub=docker.io/istio")

# Install cloud-provider-kind
cloud-provider-kind: $(CLOUD_PROVIDER_KIND)
$(CLOUD_PROVIDER_KIND): $(LOCALBIN)
	$(call go-install-tool,$(CLOUD_PROVIDER_KIND),sigs.k8s.io/cloud-provider-kind,$(CLOUD_PROVIDER_KIND_VERSION))

# go-install-tool will 'go install' any package with custom target and name of binary, if it doesn't exist
# $1 - target path with name of binary
# $2 - package url which can be installed
# $3 - specific version of package
# $4 - (optional) extra ldflags to set with the installation
define go-install-tool
@[ -f "$(1)-$(3)" ] || { \
set -e; \
package=$(2)@$(3) ;\
ldflags=$(4) ;\
echo "Downloading $${package}" ;\
rm -f $(1) || true ;\
GOBIN=$(LOCALBIN) go install $${ldflags:+-ldflags "$${ldflags}"} $${package} ;\
mv $(1) $(1)-$(3) ;\
} ;\
ln -sf $(1)-$(3) $(1)
endef

# Remove downloaded tool binaries
.PHONY: clean
clean:
	rm -rf $(LOCALBIN)
	@echo "INFO: '$(LOCALBIN)' successfully cleaned."
