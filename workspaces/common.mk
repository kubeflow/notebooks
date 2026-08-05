# Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

.PHONY: clean
clean: ## Remove local test/build artifacts.
	rm -rf $(LOCALBIN)
	@echo "INFO: '$(LOCALBIN)' successfully cleaned."

# Tool Binaries
KUSTOMIZE ?= $(LOCALBIN)/kustomize

# Tool Versions
KUSTOMIZE_VERSION ?= v5.5.0

# go-install-tool will 'go install' any package with custom target and name of binary, if it doesn't exist
# $1 - target path with name of binary
# $2 - package url which can be installed
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