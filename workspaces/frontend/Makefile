.DEFAULT_GOAL := all
include ../common.mk

# Image URL to use all building/pushing image targets
REGISTRY ?= ghcr.io/kubeflow/notebooks
NAME ?= workspaces-frontend
TAG ?= sha-$(GIT_COMMIT)$(GIT_TREE_STATE)
IMG ?= $(REGISTRY)/$(NAME):$(TAG)
ARCH ?= linux/arm64/v8,linux/amd64,linux/ppc64le


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

##@ Build

.PHONY: docker-build
docker-build:
	docker build --tag ${IMG} .

.PHONY: docker-push
docker-push:
	docker push ${IMG}

.PHONY: docker-build-multi-arch
docker-build-multi-arch:
	docker buildx build --platform ${ARCH} --tag ${IMG} .

.PHONY: docker-build-push-multi-arch
docker-build-push-multi-arch:
	docker buildx build --platform ${ARCH} --tag ${IMG} --push .

##@ Deployment

# KUSTOMIZE_DIR point at a directory containing kustomization.yaml for the frontend deployment.
# Optionally set KUSTOMIZE_IMAGE_NAME (defaults to "frontend") to the image name key used in that kustomization.

.PHONY: deploy
deploy: kustomize ## Deploy frontend to the K8s cluster specified in ~/.kube/config.
	@echo "Copying kustomize directory structure to .output..."
	@rm -rf manifests/kustomize/.output
	@mkdir -p manifests/kustomize/.output
	@cp -r manifests/kustomize/* manifests/kustomize/.output/
	# Match both short name and registry-prefixed name (base kustomization may transform either)
	@cd manifests/kustomize/.output/overlays/istio && $(KUSTOMIZE) edit set image $(NAME)=${IMG} $(REGISTRY)/$(NAME)=${IMG}
	@$(KUBECTL) apply -k manifests/kustomize/.output/overlays/istio

.PHONY: undeploy
undeploy: kustomize ## Undeploy frontend from the K8s cluster specified in ~/.kube/config.
	$(KUBECTL) delete -k manifests/kustomize/overlays/istio --ignore-not-found=true


##@ Dependencies

# Tool Binaries
KUBECTL ?= kubectl
