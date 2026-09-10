.DEFAULT_GOAL := all

include ../common.mk

# Image URL to use all building/pushing image targets
REGISTRY ?= ghcr.io/kubeflow/notebooks
NAME ?= workspaces-backend
TAG ?= sha-$(GIT_COMMIT)$(GIT_TREE_STATE)
IMG ?= $(REGISTRY)/$(NAME):$(TAG)
ARCH ?= linux/arm64/v8,linux/amd64,linux/ppc64le


# The version of Kubernetes to use for envtest.
# If updating, also update the version referenced in `BinaryAssetsDirectory` of suite_test.go files.
ENVTEST_K8S_VERSION = 1.31.0

# We set GOTOOLCHAIN to "local+auto" because we use `go-install-tool` to install tools like `kustomize`
# which may depend on a newer Go version than the local one. While "local+auto" is the implied default,
# it is not always the case, as in the `setup-go` GitHub Action which uses "local".
export GOTOOLCHAIN = local+auto

# Get the currently used golang install path (in GOPATH/bin, unless GOBIN is set)
ifeq (,$(shell go env GOBIN))
GOBIN=$(shell go env GOPATH)/bin
else
GOBIN=$(shell go env GOBIN)
endif

# Backend default port
PORT ?= 4000

# Setting SHELL to bash allows bash commands to be executed by recipes.
# Options are set to exit when a recipe line exits non-zero or a piped command fails.
SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

.PHONY: all
all: build

##@ General


##@ Development

.PHONY: fmt
fmt: ## Run go fmt against code.
	go fmt ./...

.PHONY: vet
vet: ## Run go vet against code.
	go vet ./...

.PHONY: test
test: swag fmt vet envtest ## Run tests.
	$(eval KUBEBUILDER_ASSETS := $(shell $(ENVTEST) use $(ENVTEST_K8S_VERSION) --bin-dir $(LOCALBIN) -p path))
	## For unknown reasons, setup-envtest changes the binary permissions to 0555,
	## this makes it difficult to clean up the downloaded binaries later.
	## https://github.com/kubernetes-sigs/controller-runtime/blob/v0.22.4/tools/setup-envtest/store/store.go#L191
	chmod -R u+w $(LOCALBIN)
	KUBEBUILDER_ASSETS=${KUBEBUILDER_ASSETS} go test ./... -coverprofile cover.out

.PHONY: lint
lint: golangci-lint ## Run golangci-lint linter
	$(GOLANGCI_LINT) run --max-issues-per-linter 0 --max-same-issues 0

.PHONY: lint-fix
lint-fix: golangci-lint ## Run golangci-lint linter and perform fixes
	$(GOLANGCI_LINT) run --fix --max-issues-per-linter 0 --max-same-issues 0

##@ Swagger
ALL_GO_DIRS := $(shell find . -type f -name '*.go' -exec dirname {} \; | sed 's|^\./||' | sort -u)
ALL_GO_DIRS_NO_CMD := $(shell echo "$(ALL_GO_DIRS)" | tr ' ' '\n' | grep -v '^cmd$$' | paste -sd, -)
SWAG_DIRS := cmd,$(ALL_GO_DIRS_NO_CMD)

.PHONY: swag
swag: SWAGGER ## Generate Swagger API docs.
	$(SWAGGER) fmt -g main.go -d $(SWAG_DIRS)
	$(SWAGGER) init --parseDependency -q -g main.go -d $(SWAG_DIRS) --output openapi --outputTypes go,json --requiredByDefault --templateDelims '{{{{,}}}}'

##@ Build

.PHONY: build
build: fmt vet swag ## Build backend binary.
	go build -o bin/backend cmd/main.go

.PHONY: run
run: fmt vet swag ## Run a backend from your host.
	go run ./cmd/main.go --port=$(PORT)

.PHONY: docker-build
docker-build:
	# NOTE: we are building in the context of the parent directory (..)
	docker build --tag ${IMG} --file Dockerfile ..

.PHONY: docker-push
docker-push:
	docker push ${IMG}

.PHONY: docker-build-multi-arch
docker-build-multi-arch:
	# NOTE: we are building in the context of the parent directory (..)
	docker buildx build --platform ${ARCH} --tag ${IMG} --file Dockerfile ..

.PHONY: docker-build-push-multi-arch
docker-build-push-multi-arch:
	# NOTE: we are building in the context of the parent directory (..)
	docker buildx build --platform ${ARCH} --tag ${IMG} --file Dockerfile --push ..

##@ Dependencies

## Tool Binaries
KUBECTL ?= kubectl
ENVTEST ?= $(LOCALBIN)/setup-envtest
GOLANGCI_LINT = $(LOCALBIN)/golangci-lint
SWAGGER = $(LOCALBIN)/swag

## Tool Versions
ENVTEST_VERSION ?= release-0.19
GOLANGCI_LINT_VERSION ?= v2.13.2
SWAGGER_VERSION ?= v1.16.6

.PHONY: SWAGGER
SWAGGER: $(SWAGGER)
$(SWAGGER): $(LOCALBIN)
	$(call go-install-tool,$(SWAGGER),github.com/swaggo/swag/cmd/swag,$(SWAGGER_VERSION))

.PHONY: envtest
envtest: $(ENVTEST) ## Download setup-envtest locally if necessary.
$(ENVTEST): $(LOCALBIN)
	$(call go-install-tool,$(ENVTEST),sigs.k8s.io/controller-runtime/tools/setup-envtest,$(ENVTEST_VERSION))

.PHONY: golangci-lint
golangci-lint: $(GOLANGCI_LINT) ## Download golangci-lint locally if necessary.
$(GOLANGCI_LINT): $(LOCALBIN)
	$(call go-install-tool,$(GOLANGCI_LINT),github.com/golangci/golangci-lint/v2/cmd/golangci-lint,$(GOLANGCI_LINT_VERSION))


##@ deployment

.PHONY: deploy
deploy: kustomize ## Deploy backend to the K8s cluster specified in ~/.kube/config.
	@echo "Copying kustomize directory structure to .output..."
	@rm -rf manifests/kustomize/.output
	@mkdir -p manifests/kustomize/.output
	@cp -r manifests/kustomize/* manifests/kustomize/.output/
	# Match both short name and registry-prefixed name (base kustomization may transform either)
	@cd manifests/kustomize/.output/overlays/istio && $(KUSTOMIZE) edit set image $(NAME)=${IMG} $(REGISTRY)/$(NAME)=${IMG}
	@$(KUBECTL) apply -k manifests/kustomize/.output/overlays/istio

.PHONY: undeploy
undeploy: kustomize ## Undeploy backend from the K8s cluster specified in ~/.kube/config.
	$(KUBECTL) delete -k manifests/kustomize/overlays/istio --ignore-not-found=true
