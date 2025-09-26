GIT_COMMIT     := $(shell git rev-parse HEAD)
GIT_TREE_STATE := $(shell test -n "`git status --porcelain`" && echo "-dirty" || echo "")

# Image URL to use all building/pushing image targets
REGISTRY ?= ghcr.io/kubeflow/notebooks
NAME ?= workspaces-backend
TAG ?= sha-$(GIT_COMMIT)$(GIT_TREE_STATE)
IMG ?= $(REGISTRY)/$(NAME):$(TAG)
ARCH ?= linux/arm64/v8,linux/amd64,linux/ppc64le


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

##@ Development

.PHONY: fmt
fmt: ## Run go fmt against code.
	go fmt ./...

.PHONY: vet
vet: ## Run go vet against code.
	go vet ./...

.PHONY: test
test: fmt vet envtest ## Run tests.
	KUBEBUILDER_ASSETS="$(shell $(ENVTEST) use $(ENVTEST_K8S_VERSION) --bin-dir $(LOCALBIN) -p path)" go test ./... -coverprofile cover.out

.PHONY: lint
lint: golangci-lint ## Run golangci-lint linter
	$(GOLANGCI_LINT) run

.PHONY: lint-fix
lint-fix: golangci-lint ## Run golangci-lint linter and perform fixes
	$(GOLANGCI_LINT) run --fix

##@ Swagger
ALL_GO_DIRS := $(shell find . -type f -name '*.go' -exec dirname {} \; | sed 's|^\./||' | sort -u)
ALL_GO_DIRS_NO_CMD := $(shell echo "$(ALL_GO_DIRS)" | tr ' ' '\n' | grep -v '^cmd$$' | paste -sd, -)
SWAG_DIRS := cmd,$(ALL_GO_DIRS_NO_CMD)

.PHONY: swag
swag: SWAGGER
	$(SWAGGER) fmt -g main.go -d $(SWAG_DIRS)
	$(SWAGGER) init --parseDependency -q -g main.go -d $(SWAG_DIRS) --output openapi --outputTypes go,json --requiredByDefault

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

## Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

## Tool Binaries
KUBECTL ?= kubectl
KUSTOMIZE := $(LOCALBIN)/kustomize
ENVTEST ?= $(LOCALBIN)/setup-envtest
GOLANGCI_LINT = $(LOCALBIN)/golangci-lint
SWAGGER = $(LOCALBIN)/swag

## Tool Versions
KUSTOMIZE_VERSION ?= v5.5.0
ENVTEST_VERSION ?= release-0.19
GOLANGCI_LINT_VERSION ?= v1.61.0
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
	$(call go-install-tool,$(GOLANGCI_LINT),github.com/golangci/golangci-lint/cmd/golangci-lint,$(GOLANGCI_LINT_VERSION))


##@ deployment

.PHONY: deploy
deploy: kustomize ## Deploy backend to the K8s cluster specified in ~/.kube/config.
	cd manifests/kustomize/overlays/istio && $(KUSTOMIZE) edit set image workspaces-backend=${IMG}
	$(KUBECTL) apply -k manifests/kustomize/overlays/istio

.PHONY: undeploy
undeploy: kustomize ## Undeploy backend from the K8s cluster specified in ~/.kube/config.
	$(KUBECTL) delete -k manifests/kustomize/overlays/istio --ignore-not-found=true


##@ Dependencies

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