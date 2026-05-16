include ../common.mk

NAME ?= workspaces-backend

# Backend default port
PORT ?= 4000

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
test: swag fmt vet envtest ## Run tests.
	$(eval KUBEBUILDER_ASSETS := $(shell $(ENVTEST) use $(ENVTEST_K8S_VERSION) --bin-dir $(LOCALBIN) -p path))
	## For unknown reasons, setup-envtest changes the binary permissions to 0555,
	## this makes it difficult to clean up the downloaded binaries later.
	## https://github.com/kubernetes-sigs/controller-runtime/blob/v0.22.4/tools/setup-envtest/store/store.go#L191
	chmod -R u+w $(LOCALBIN)
	KUBEBUILDER_ASSETS=${KUBEBUILDER_ASSETS} go test ./... -coverprofile cover.out

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

##@ Deployment

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

##@ Dependencies

## Backend-specific tool binaries
SWAGGER = $(LOCALBIN)/swag

## Backend-specific tool versions
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

.PHONY: kustomize
kustomize: $(KUSTOMIZE) ## Download kustomize locally if necessary.
$(KUSTOMIZE): $(LOCALBIN)
	$(call go-install-tool,$(KUSTOMIZE),sigs.k8s.io/kustomize/kustomize/v5,$(KUSTOMIZE_VERSION))
