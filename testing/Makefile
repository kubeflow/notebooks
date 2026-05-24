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

.PHONY: setup-cluster
setup-cluster: check-kubectl check-kind ## Set up a complete kind cluster with cert-manager and Istio.
	bash scripts/setup-kind.sh
	bash scripts/setup-cert-manager.sh
	bash scripts/setup-istio.sh

.PHONY: teardown-cluster
teardown-cluster: check-kind ## Delete the Kind cluster.
	kind delete cluster --name $(KIND_CLUSTER_NAME)

.PHONY: deploy-controller
deploy-controller: check-kind check-kind-context ## Build and deploy the controller.
	$(MAKE) -C ../workspaces/controller docker-build IMG=$(CONTROLLER_IMG)
	kind load docker-image $(CONTROLLER_IMG) --name $(KIND_CLUSTER_NAME)
	$(MAKE) -C ../workspaces/controller deploy IMG=$(CONTROLLER_IMG)

.PHONY: deploy-backend
deploy-backend: check-kind check-kind-context ## Build and deploy the backend.
	$(MAKE) -C ../workspaces/backend docker-build IMG=$(BACKEND_IMG)
	kind load docker-image $(BACKEND_IMG) --name $(KIND_CLUSTER_NAME)
	$(MAKE) -C ../workspaces/backend deploy IMG=$(BACKEND_IMG)

.PHONY: deploy-frontend
deploy-frontend: check-kind check-kind-context ## Build and deploy the frontend.
	$(MAKE) -C ../workspaces/frontend docker-build IMG=$(FRONTEND_IMG)
	kind load docker-image $(FRONTEND_IMG) --name $(KIND_CLUSTER_NAME)
	$(MAKE) -C ../workspaces/frontend deploy IMG=$(FRONTEND_IMG)

.PHONY: deploy-all
deploy-all: deploy-controller deploy-backend deploy-frontend ## Deploy all components.

##@ E2E Tests

.PHONY: sanity-check
sanity-check: check-kind-context ## Verify all components are deployed and responding.
	@bash scripts/sanity-check.sh

.PHONY: local-e2e
local-e2e: check-kind-context ## Run e2e tests.
	@bash ssh-smoke/run-ssh-smoke-test.sh

##@ Dependencies

## Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

.PHONY: check-kind
check-kind: ## Verify that kind is available in PATH.
	@command -v kind >/dev/null 2>&1 || { \
		echo "ERROR: kind is not found in PATH. Please install kind."; \
		exit 1; \
	}

.PHONY: check-kind-context
check-kind-context: ## Verify that the current kubectl context is set to the expected kind cluster.
	@{ \
		current_context=$$(kubectl config current-context); \
		expected_context="kind-$(KIND_CLUSTER_NAME)"; \
		if [ "$$current_context" != "$$expected_context" ]; then \
			echo "ERROR: Current kubectl context is '$$current_context', but expected '$$expected_context'."; \
			echo "ERROR: switch to the correct context using: kubectl config use-context $$expected_context"; \
			exit 1; \
		fi; \
	}

.PHONY: check-kubectl
check-kubectl: ## Verify that kubectl is available in PATH.
	@command -v kubectl >/dev/null 2>&1 || { \
		echo "ERROR: kubectl is not found in PATH. Please install kubectl."; \
		exit 1; \
	}

.PHONY: clean
clean: ## Remove downloaded tool binaries.
	rm -rf $(LOCALBIN)
	@echo "INFO: '$(LOCALBIN)' successfully cleaned."
