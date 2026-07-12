# Variables
CLUSTER_NAME := tilt
KIND_CONTEXT := kind-$(CLUSTER_NAME)

# Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

# Tool Binaries
KUSTOMIZE ?= $(LOCALBIN)/kustomize

# Tool Versions
KUSTOMIZE_VERSION ?= v5.5.0

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

# Run tilt up with kind cluster, cert-manager, and Istio setup
.PHONY: tilt-up
tilt-up: kustomize check-tilt setup-kind setup-istio setup-prometheus setup-metrics-server
	@echo "Starting Tilt..."
	@tilt up

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
