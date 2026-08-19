GIT_COMMIT     := $(shell git rev-parse HEAD)
GIT_TREE_STATE := $(shell test -n "`git status --porcelain`" && echo "-dirty" || echo "")

# Image URL to use all building/pushing image targets
REGISTRY ?= ghcr.io/kubeflow/notebooks
NAME ?= workspaces-authz
TAG ?= sha-$(GIT_COMMIT)$(GIT_TREE_STATE)
IMG ?= $(REGISTRY)/$(NAME):$(TAG)
ARCH ?= linux/arm64/v8,linux/amd64,linux/ppc64le

export GOTOOLCHAIN = local+auto

ifeq (,$(shell go env GOBIN))
GOBIN=$(shell go env GOPATH)/bin
else
GOBIN=$(shell go env GOBIN)
endif

.PHONY: all
all: build

##@ General

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
test: fmt vet ## Run tests.
	go test ./... -coverprofile cover.out

.PHONY: lint
lint: golangci-lint ## Run golangci-lint linter
	$(GOLANGCI_LINT) run

.PHONY: lint-fix
lint-fix: golangci-lint ## Run golangci-lint linter and perform fixes
	$(GOLANGCI_LINT) run --fix

##@ Build

.PHONY: build
build: fmt vet ## Build authz binary.
	go build -o bin/authz ./cmd/main.go

.PHONY: clean
clean: ## Remove local test/build artifacts.
	rm -rf bin cover.out

.PHONY: docker-build
docker-build: ## Build the container image.
	docker build -t ${IMG} .

.PHONY: docker-push
docker-push: ## Push the container image.
	docker push ${IMG}

.PHONY: docker-build-multi-arch
docker-build-multi-arch: ## Build the container image for multiple architectures.
	docker buildx build --platform ${ARCH} -t ${IMG} .

##@ Deployment

.PHONY: deploy
deploy: kustomize ## Deploy authz to the K8s cluster specified in ~/.kube/config.
	cd manifests/kustomize/base && $(KUSTOMIZE) edit set image workspaces-authz=${IMG}
	$(KUSTOMIZE) build manifests/kustomize/base | kubectl apply -f -

.PHONY: undeploy
undeploy: kustomize ## Undeploy authz from the K8s cluster specified in ~/.kube/config.
	$(KUSTOMIZE) build manifests/kustomize/base | kubectl delete --ignore-not-found=true -f -

##@ Dependencies

LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

KUSTOMIZE ?= $(LOCALBIN)/kustomize
GOLANGCI_LINT ?= $(LOCALBIN)/golangci-lint

KUSTOMIZE_VERSION ?= v5.5.0
GOLANGCI_LINT_VERSION ?= v1.64.8

.PHONY: kustomize
kustomize: $(KUSTOMIZE) ## Download kustomize locally if necessary.
$(KUSTOMIZE): $(LOCALBIN)
	GOBIN=$(LOCALBIN) go install sigs.k8s.io/kustomize/kustomize/v5@$(KUSTOMIZE_VERSION)

.PHONY: golangci-lint
golangci-lint: $(GOLANGCI_LINT) ## Download golangci-lint locally if necessary.
$(GOLANGCI_LINT): $(LOCALBIN)
	GOBIN=$(LOCALBIN) go install github.com/golangci/golangci-lint/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION)

##@ Secrets

.PHONY: cookie-key
cookie-key: ## Print a fresh base64-encoded session cookie key.
	@head -c 32 /dev/urandom | base64
