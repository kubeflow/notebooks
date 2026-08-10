# -----------------------------------------------------------------------------
# Git / local dependencies
# -----------------------------------------------------------------------------

GIT_COMMIT     := $(shell git rev-parse HEAD)
GIT_TREE_STATE := $(shell test -n "`git status --porcelain`" && echo "-dirty" || echo "")

LOCALBIN ?= $(shell pwd)/bin

$(LOCALBIN):
	mkdir -p $(LOCALBIN)

# -----------------------------------------------------------------------------
# Shell
# -----------------------------------------------------------------------------

SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

# -----------------------------------------------------------------------------
# Common image configuration
# -----------------------------------------------------------------------------

REGISTRY ?= ghcr.io/kubeflow/notebooks
TAG ?= sha-$(GIT_COMMIT)$(GIT_TREE_STATE)
IMG ?= $(REGISTRY)/$(NAME):$(TAG)
ARCH ?= linux/arm64/v8,linux/amd64,linux/ppc64le

# -----------------------------------------------------------------------------
# Kubernetes
# -----------------------------------------------------------------------------

KUBECTL ?= kubectl
KUSTOMIZE ?= $(LOCALBIN)/kustomize
KUSTOMIZE_VERSION ?= v5.5.0

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------

.PHONY: clean
clean: ## Remove local test/build artifacts.
	rm -rf $(LOCALBIN)
	@echo "INFO: '$(LOCALBIN)' successfully cleaned."

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m**\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

# -----------------------------------------------------------------------------
# Common Docker targets
# -----------------------------------------------------------------------------

.PHONY: docker-push
docker-push: ## Push Docker image.
	docker push $(IMG)

# -----------------------------------------------------------------------------
# Kustomize
# -----------------------------------------------------------------------------

.PHONY: kustomize
kustomize: $(KUSTOMIZE) ## Download kustomize locally if necessary.

$(KUSTOMIZE): $(LOCALBIN)
	$(call go-install-tool,$(KUSTOMIZE),sigs.k8s.io/kustomize/kustomize/v5,$(KUSTOMIZE_VERSION))

# -----------------------------------------------------------------------------
# Deployment
# -----------------------------------------------------------------------------

.PHONY: deploy
deploy: kustomize ## Deploy to the Kubernetes cluster specified in ~/.kube/config.
	@echo "Copying kustomize directory structure to .output..."
	@rm -rf manifests/kustomize/.output
	@mkdir -p manifests/kustomize/.output
	@cp -r manifests/kustomize/* manifests/kustomize/.output/
	# Match both short name and registry-prefixed name.
	@cd manifests/kustomize/.output/overlays/istio && \
		$(KUSTOMIZE) edit set image \
			$(NAME)=$(IMG) \
			$(REGISTRY)/$(NAME)=$(IMG)
	@$(KUBECTL) apply -k manifests/kustomize/.output/overlays/istio

# -----------------------------------------------------------------------------
# Tool installation
# -----------------------------------------------------------------------------

define go-install-tool
@[ -f "$(1)-$(3)" ] || { \
	set -e; \
	package=$(2)@$(3); \
	ldflags=$(4); \
	echo "Downloading $${package}"; \
	rm -f $(1) || true; \
	GOBIN=$(LOCALBIN) go install $${ldflags:+-ldflags "$${ldflags}"} $${package}; \
	mv $(1) $(1)-$(3); \
}; \
ln -sf $(1)-$(3) $(1)
endef