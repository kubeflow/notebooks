GIT_COMMIT     := $(shell git rev-parse HEAD)

GIT_TREE_STATE := $(shell test -n "`git status --porcelain`" && echo "-dirty" || echo "")

# Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

# Shared help display for workspace Makefiles.
# Prints only populated categories and normalizes section titles.
.PHONY: help
help: ## Display this help.
	@awk 'BEGIN { FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n" } /^##@/ { current_section = substr($$0, 5); gsub(/^[[:space:]]+/, "", current_section); gsub(/[[:space:]]+$$/, "", current_section); if (current_section == "") current_section = "General"; current_section = toupper(substr(current_section, 1, 1)) substr(current_section, 2); next } /^[a-zA-Z_0-9-]+:.*?##/ && $$1 != "help" { if (!seen_section[current_section]++) printf "\n\033[1m%s\033[0m\n", current_section; printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Clean

.PHONY: clean
clean: ## Remove local test/build artifacts.
	rm -rf $(LOCALBIN)
	@echo "INFO: '$(LOCALBIN)' successfully cleaned."

##@ Dependency

# Tool Binaries
KUSTOMIZE ?= $(LOCALBIN)/kustomize

# Tool Versions
KUSTOMIZE_VERSION ?= v5.5.0

.PHONY: kustomize
kustomize: $(KUSTOMIZE) ## Download kustomize locally if necessary.
$(KUSTOMIZE): $(LOCALBIN)
	$(call go-install-tool,$(KUSTOMIZE),sigs.k8s.io/kustomize/kustomize/v5,$(KUSTOMIZE_VERSION))


# $3 - specific version of package
# $4 - (optional) extra ldflags to set with the installation
define go-install-tool
@[ -f "$(1)-$(3)" ] || { \
set -e; \
package=$(2)@$(3) ;\
ldflags=$(4) ;\
echo "Downloading $${package}" ;\
rm -f $(1) || true ;\
GOBIN=$(LOCALBIN) go install $${ldflags:+-ldflags "$${ldflags}"} $${package} ;\
mv $(1) $(1)-$(3) ;\
} ;\
ln -sf $(1)-$(3) $(1)
endef
