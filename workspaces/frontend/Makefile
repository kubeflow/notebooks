# Image URL to use for building/pushing the frontend image
IMG ?= nbv2-frontend:latest

# CONTAINER_TOOL defines the container tool to be used for building images.
# Tested with Docker by default. You may replace with podman.
CONTAINER_TOOL ?= docker

# Setting SHELL to bash allows bash commands to be executed by recipes.
# Options are set to exit when a recipe line exits non-zero or a piped command fails.
SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

.PHONY: all
all: help

##@ General

# The help target prints all targets with descriptions organized beneath categories.
.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Clean

.PHONY: clean
clean: ## Remove local test/build artifacts.
	rm -rf ./bin ./Dockerfile.cross

##@ Build

# If you wish to build the image targeting other platforms you can use the --platform flag.
# (i.e. docker build --platform linux/arm64). Requires Docker BuildKit.
.PHONY: docker-build
docker-build: ## Build docker image for the frontend.
	$(CONTAINER_TOOL) build -t ${IMG} .

.PHONY: docker-push
docker-push: ## Push docker image for the frontend.
	$(CONTAINER_TOOL) push ${IMG}

# PLATFORMS defines the target platforms for cross-platform support.
PLATFORMS ?= linux/arm64/v8,linux/amd64,linux/ppc64le

.PHONY: docker-buildx
docker-buildx: ## Build and push docker image for cross-platform support.
	# copy existing Dockerfile and insert --platform=$${BUILDPLATFORM} into Dockerfile.cross, preserving the original
	sed -e '1 s/\(^FROM\)/FROM --platform=\$$\{BUILDPLATFORM\}/; t' -e ' 1,// s//FROM --platform=\$$\{BUILDPLATFORM\}/' Dockerfile > Dockerfile.cross
	- $(CONTAINER_TOOL) buildx create --name project-v3-builder
	$(CONTAINER_TOOL) buildx use project-v3-builder
	- $(CONTAINER_TOOL) buildx build --push --platform=$(PLATFORMS) --tag ${IMG} -f Dockerfile.cross .
	- $(CONTAINER_TOOL) buildx rm project-v3-builder
	rm Dockerfile.cross

##@ Deployment

# KUSTOMIZE_DIR point at a directory containing kustomization.yaml for the frontend deployment.
# Optionally set KUSTOMIZE_IMAGE_NAME (defaults to "frontend") to the image name key used in that kustomization.

.PHONY: deploy
deploy: kustomize ## Deploy frontend to the K8s cluster specified in ~/.kube/config.
	cd manifests/kustomize/overlays/istio && $(KUSTOMIZE) edit set image workspaces-frontend=${IMG}
	$(KUBECTL) apply -k manifests/kustomize/overlays/istio

.PHONY: undeploy
undeploy: kustomize ## Undeploy frontend from the K8s cluster specified in ~/.kube/config.
	$(KUBECTL) delete -k manifests/kustomize/overlays/istio --ignore-not-found=true


##@ Dependencies

# Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

# Tool Binaries
KUBECTL ?= kubectl
KUSTOMIZE ?= $(LOCALBIN)/kustomize

# Tool Versions
KUSTOMIZE_VERSION ?= v5.5.0

.PHONY: kustomize
kustomize: $(KUSTOMIZE) ## Download kustomize locally if necessary.
$(KUSTOMIZE): $(LOCALBIN)
	$(call go-install-tool,$(KUSTOMIZE),sigs.k8s.io/kustomize/kustomize/v5,$(KUSTOMIZE_VERSION))

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
