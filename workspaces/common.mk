GIT_COMMIT     := $(shell git rev-parse HEAD)

GIT_TREE_STATE := $(shell test -n "`git status --porcelain`" && echo "-dirty" || echo "")

# Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

##@ General

# The help target prints out all targets with their descriptions organized
# beneath their categories. The categories are represented by '##@' and the
# target descriptions by '##'. The awk command reads all makefiles in this
# invocation (including common.mk via 'include'), collecting targets matching
# 'xyz: ## something' and grouping them under the most recent '##@' category.
# Duplicate category names across files are merged into a single group, and
# categories with no matching targets are omitted from the output.
# More info on the usage of ANSI control characters for terminal formatting:
# https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
# More info on the awk command:
# http://linuxcommand.org/lc3_adv_awk.php

.PHONY: help
help: ## Display this help.
      @awk 'BEGIN { FS = ":.*## "; current = "General" } \
              /^##@/ { current = substr($$0, 5) } \
              /^[a-zA-Z_0-9-]+:.*?##/ { \
                      entries[current] = entries[current] sprintf("  \033[36m%-20s\033[0m %s\n", $$1, $$2); \
                      if (!seen[current]++) { order[++count] = current } \
              } \
              END { \
                      printf "\nUsage:\n  make \033[36m<target>\033[0m\n"; \
                      for (i = 1; i <= count; i++) { \
                              printf "\n\033[1m%s\033[0m\n", order[i]; \
                              printf "%s", entries[order[i]]; \
                      } \
              }' $(MAKEFILE_LIST)

##@ Clean

.PHONY: clean
clean: ## Remove local test/build artifacts.
	rm -rf $(LOCALBIN)
	@echo "INFO: '$(LOCALBIN)' successfully cleaned."

##@ Dependencies

# Tool Binaries
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
