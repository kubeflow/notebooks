GIT_COMMIT     := $(shell git rev-parse HEAD)
GIT_TREE_STATE := $(shell test -n "`git status --porcelain`" && echo "-dirty" || echo "")

# Image URL to use all building/pushing image targets
REGISTRY ?= ghcr.io/kubeflow/notebooks
TAG ?= sha-$(GIT_COMMIT)$(GIT_TREE_STATE)

CONTROLLER_NAME ?= workspaces-controller
CONTROLLER_IMG ?= $(REGISTRY)/$(CONTROLLER_NAME):$(TAG)

BACKEND_NAME ?= workspaces-backend
BACKEND_IMG ?= $(REGISTRY)/$(BACKEND_NAME):$(TAG)

FRONTEND_NAME ?= workspaces-frontend
FRONTEND_IMG ?= $(REGISTRY)/$(FRONTEND_NAME):$(TAG)

KIND_CLUSTER_NAME ?= local-e2e

# Setting SHELL to bash allows bash commands to be executed by recipes.
# Options are set to exit when a recipe line exits non-zero or a piped command fails.
SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec


# Export KIND_EXPERIMENTAL_PROVIDER to honor it if set in user's environment
# (e.g., KIND_EXPERIMENTAL_PROVIDER=podman for podman support)
export KIND_EXPERIMENTAL_PROVIDER

##@ General

# The help target prints out all targets with their descriptions organized
# beneath their categories. The categories are represented by '##@' and the
# target descriptions by '##'. The awk command is responsible for reading the
# entire set of makefiles included in this invocation, looking for lines of the
# file as xyz: ## something, and then pretty-format the target and help. Then,
# if there's a line with ##@ something, that gets pretty-printed as a category.
# More info on the usage of ANSI control characters for terminal formatting:
# https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
# More info on the awk command:
# http://linuxcommand.org/lc3_adv_awk.php

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Deployment

.PHONY: build-controller build-backend build-frontend build-all e2e

deploy-controller: kind check-kind-context ## Build and deploy the controller.
	cd ../workspaces/controller && $(MAKE) docker-build IMG=$(CONTROLLER_IMG)
	$(KIND) load docker-image $(CONTROLLER_IMG) --name $(KIND_CLUSTER_NAME)
	cd ../workspaces/controller && $(MAKE) deploy IMG=$(CONTROLLER_IMG)

deploy-backend: kind check-kind-context ## Build and deploy the backend.
	cd ../workspaces/backend && $(MAKE) docker-build IMG=$(BACKEND_IMG)
	$(KIND) load docker-image $(BACKEND_IMG) --name $(KIND_CLUSTER_NAME)
	cd ../workspaces/backend && $(MAKE) deploy IMG=$(BACKEND_IMG)

deploy-frontend: kind check-kind-context ## Build and deploy the frontend.
	cd ../workspaces/frontend && $(MAKE) docker-build IMG=$(FRONTEND_IMG)
	$(KIND) load docker-image $(FRONTEND_IMG) --name $(KIND_CLUSTER_NAME)
	cd ../workspaces/frontend && $(MAKE) deploy IMG=$(FRONTEND_IMG)

deploy-all: deploy-controller deploy-backend deploy-frontend ## Deploy all components.

local-e2e: deploy-all istioctl ## Run e2e tests.
	@echo "TODO: Run e2e tests..."


##@ Dependencies

## Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

## Tool Binaries
KIND ?= $(LOCALBIN)/kind
KUBECTL ?= kubectl
ISTIOCTL ?= $(LOCALBIN)/istioctl

## Tool Versions
KIND_VERSION ?= v0.30.0
ISTIOCTL_VERSION ?= 1.27.3

.PHONY: kind
kind: $(KIND) ## Download kind locally if necessary.
$(KIND): $(LOCALBIN)
	$(call go-install-tool,$(KIND),sigs.k8s.io/kind,$(KIND_VERSION))

.PHONY: check-kubectl
check-kubectl: ## Verify that kubectl is available in PATH.
	@if ! command -v $(KUBECTL) >/dev/null 2>&1; then \
		echo "✗ ERROR: kubectl is not installed or not found in PATH"; \
		echo "  Please install kubectl: https://kubernetes.io/docs/tasks/tools/#kubectl"; \
		exit 1; \
	fi
	@echo "✓ kubectl found: $$($(KUBECTL) version --client 2>/dev/null || echo 'version check failed')"

.PHONY: istioctl
istioctl: $(ISTIOCTL) ## Download istioctl locally if necessary.
$(ISTIOCTL): $(LOCALBIN)
	$(call go-install-tool,$(ISTIOCTL),istio.io/istio/istioctl/cmd/istioctl,$(ISTIOCTL_VERSION))

.PHONY: dependency-hash
dependency-hash: ## Calculate hash of dependency versions for caching.
	@echo -e "KIND_VERSION=$(KIND_VERSION)\nISTIOCTL_VERSION=$(ISTIOCTL_VERSION)" | sha256sum | cut -d' ' -f1 | head -c 16

.PHONY: setup-cluster
setup-cluster: check-kubectl kind istioctl ## Set up a complete kind cluster with cert-manager and Istio.
	@export PATH="$(LOCALBIN):$$PATH" && \
		bash scripts/setup-kind.sh && \
		bash scripts/setup-cert-manager.sh && \
		bash scripts/setup-istio.sh
	@echo "✓ Cluster setup complete"

.PHONY: check-kind-context
check-kind-context: check-kubectl ## Verify that the current kubectl context is a kind cluster.
	@current_context=$$($(KUBECTL) config current-context 2>/dev/null) || { \
		echo "Error: Unable to get current kubectl context. Is kubectl configured?"; \
		exit 1; \
	}; \
	server_url=$$($(KUBECTL) config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null) || { \
		echo "Error: Unable to get cluster server URL for context '$$current_context'"; \
		exit 1; \
	}; \
	context_check=0; \
	server_check=0; \
	if echo "$$current_context" | grep -qE '^kind-'; then \
		context_check=1; \
	fi; \
	if echo "$$server_url" | grep -qE '(127\.0\.0\.1|localhost)'; then \
		server_check=1; \
	fi; \
	if [ $$context_check -ne 1 ] || [ $$server_check -ne 1 ]; then \
		echo "✗ ERROR: Current context '$$current_context' does not appear to be a kind cluster!"; \
		if [ $$context_check -ne 1 ]; then \
			echo "  ✗ Context name does not match kind-* pattern (got: $$current_context)"; \
		fi; \
		if [ $$server_check -ne 1 ]; then \
			echo "  ✗ Server URL does not use localhost/127.0.0.1 (got: $$server_url)"; \
		fi; \
		exit 1; \
	fi

# go-install-tool will 'go install' any package with custom target and name of binary, if it doesn't exist
# $1 - target path with name of binary
# $2 - package url which can be installed
# $3 - specific version of package
define go-install-tool
@[ -f "$(1)-$(3)" ] || { \
set -e; \
package=$(2)@$(3) ;\
echo "Downloading $${package}" ;\
rm -f $(1) || true ;\
GOBIN=$(LOCALBIN) go install $${package} ;\
mv $(1) $(1)-$(3) ;\
} ;\
ln -sf $(1)-$(3) $(1)
endef
