include ../common.mk

.DEFAULT_GOAL := all

NAME ?= workspaces-controller

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

.PHONY: manifests
manifests: controller-gen ## Generate WebhookConfiguration, ClusterRole and CustomResourceDefinition objects.
	$(CONTROLLER_GEN) rbac:roleName=workspaces-manager-role crd webhook paths="./..." \
		output:crd:artifacts:config=manifests/kustomize/base/crd \
		output:webhook:artifacts:config=manifests/kustomize/base/webhook \
		output:rbac:artifacts:config=manifests/kustomize/base/manager

.PHONY: generate
generate: controller-gen ## Generate code containing DeepCopy, DeepCopyInto, and DeepCopyObject method implementations.
	$(CONTROLLER_GEN) object:headerFile="hack/boilerplate.go.txt" paths="./..."

.PHONY: fmt
fmt: ## Run go fmt against code.
	go fmt ./...

.PHONY: vet
vet: ## Run go vet against code.
	go vet ./...

.PHONY: test
test: manifests generate fmt vet envtest ## Run tests.
	$(eval KUBEBUILDER_ASSETS := $(shell $(ENVTEST) use $(ENVTEST_K8S_VERSION) --bin-dir $(LOCALBIN) -p path))
	## For unknown reasons, setup-envtest changes the binary permissions to 0555,
	## this makes it difficult to clean up the downloaded binaries later.
	## https://github.com/kubernetes-sigs/controller-runtime/blob/v0.22.4/tools/setup-envtest/store/store.go#L191
	chmod -R u+w $(LOCALBIN)
	KUBEBUILDER_ASSETS=${KUBEBUILDER_ASSETS} go test $$(go list ./... | grep -v /e2e) -coverprofile cover.out

# The default setup assumes Kind is pre-installed and builds/loads the Manager Docker image locally.
# Prometheus, CertManager, and Istio are installed by default; skip with:
# - PROMETHEUS_INSTALL_SKIP=true
# - CERT_MANAGER_INSTALL_SKIP=true
# - ISTIO_INSTALL_SKIP=true
.PHONY: test-e2e
test-e2e: manifests generate fmt vet istioctl ## Run the e2e tests. Expected an isolated environment using Kind.
	@command -v kind >/dev/null 2>&1 || { \
		echo "Kind is not installed. Please install Kind manually."; \
		exit 1; \
	}
	@kind get clusters | grep -q 'kind' || { \
		echo "No Kind cluster is running. Please start a Kind cluster before running the e2e tests."; \
		exit 1; \
	}

	go test ./test/e2e/ -v -ginkgo.v

.PHONY: lint
lint: golangci-lint ## Run golangci-lint linter
	$(GOLANGCI_LINT) run

.PHONY: lint-fix
lint-fix: golangci-lint ## Run golangci-lint linter and perform fixes
	$(GOLANGCI_LINT) run --fix

##@ Build

.PHONY: build
build: manifests generate fmt vet ## Build manager binary.
	go build -o bin/manager cmd/main.go

.PHONY: run
run: manifests generate fmt vet ## Run a controller from your host.
	go run ./cmd/main.go

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

ifndef ignore-not-found
  ignore-not-found = false
endif

.PHONY: install
install: manifests kustomize ## Install CRDs into the K8s cluster specified in ~/.kube/config.
	$(KUSTOMIZE) build manifests/kustomize/base/crd | $(KUBECTL) apply -f -

.PHONY: uninstall
uninstall: manifests kustomize ## Uninstall CRDs from the K8s cluster specified in ~/.kube/config. Call with ignore-not-found=true to ignore resource not found errors during deletion.
	$(KUSTOMIZE) build manifests/kustomize/base/crd | $(KUBECTL) delete --ignore-not-found=$(ignore-not-found) -f -

.PHONY: deploy
deploy: manifests kustomize ## Deploy controller to the K8s cluster specified in ~/.kube/config.
	@echo "Copying kustomize directory structure to .output..."
	@rm -rf manifests/kustomize/.output
	@mkdir -p manifests/kustomize/.output
	@cp -r manifests/kustomize/* manifests/kustomize/.output/
	# Match both short name and registry-prefixed name (base kustomization may transform either)
	@cd manifests/kustomize/.output/overlays/istio && $(KUSTOMIZE) edit set image $(NAME)=${IMG} $(REGISTRY)/$(NAME)=${IMG}
	@$(KUBECTL) apply -k manifests/kustomize/.output/overlays/istio

.PHONY: undeploy
undeploy: kustomize ## Undeploy controller from the K8s cluster specified in ~/.kube/config. Call with ignore-not-found=true to ignore resource not found errors during deletion.
	$(KUBECTL) delete -k manifests/kustomize/overlays/istio --ignore-not-found=$(ignore-not-found)

##@ Dependencies

## Controller-specific tool binaries
CONTROLLER_GEN ?= $(LOCALBIN)/controller-gen
ISTIOCTL ?= $(LOCALBIN)/istioctl

## Controller-specific tool versions
CONTROLLER_TOOLS_VERSION ?= v0.20.1
ISTIOCTL_VERSION ?= 1.27.3

.PHONY: kustomize
kustomize: $(KUSTOMIZE) ## Download kustomize locally if necessary.
$(KUSTOMIZE): $(LOCALBIN)
	$(call go-install-tool,$(KUSTOMIZE),sigs.k8s.io/kustomize/kustomize/v5,$(KUSTOMIZE_VERSION))

.PHONY: controller-gen
controller-gen: $(CONTROLLER_GEN) ## Download controller-gen locally if necessary.
$(CONTROLLER_GEN): $(LOCALBIN)
	$(call go-install-tool,$(CONTROLLER_GEN),sigs.k8s.io/controller-tools/cmd/controller-gen,$(CONTROLLER_TOOLS_VERSION))

.PHONY: envtest
envtest: $(ENVTEST) ## Download setup-envtest locally if necessary.
$(ENVTEST): $(LOCALBIN)
	$(call go-install-tool,$(ENVTEST),sigs.k8s.io/controller-runtime/tools/setup-envtest,$(ENVTEST_VERSION))


.PHONY: istioctl
istioctl: $(ISTIOCTL) ## Download istioctl locally if necessary.
$(ISTIOCTL): $(LOCALBIN)
	$(call go-install-tool,$(ISTIOCTL),istio.io/istio/istioctl/cmd/istioctl,$(ISTIOCTL_VERSION),"-X istio.io/istio/pkg/version.buildVersion=$(ISTIOCTL_VERSION) -X istio.io/istio/pkg/version.buildTag=$(ISTIOCTL_VERSION) -X istio.io/istio/pkg/version.buildHub=docker.io/istio")

.PHONY: golangci-lint
golangci-lint: $(GOLANGCI_LINT) ## Download golangci-lint locally if necessary.
$(GOLANGCI_LINT): $(LOCALBIN)
	$(call go-install-tool,$(GOLANGCI_LINT),github.com/golangci/golangci-lint/cmd/golangci-lint,$(GOLANGCI_LINT_VERSION))
