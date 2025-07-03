detected_OS := $(shell uname -s)
real_OS := $(detected_OS)
arch := $(shell uname -m)
goarch := $(shell go env GOARCH)
ifeq ($(detected_OS),Darwin)
	detected_OS := mac
	real_OS := darwin
endif
ifeq ($(detected_OS),Linux)
	detected_OS := linux
	real_OS := linux
endif

## Cleanup targets

.PHONY: cleanup-crds
cleanup-crds:
	@echo "Cleaning up CRDs..."
	@kubectl delete -f ../config/crd/bases/ || true

## Requirements

.PHONY: check-cert-manager
check-cert-manager: cmctl
	@echo "Verifying cert-manager installation..."
	@$(LOCALBIN)/cmctl check api > /dev/null 2>&1 || (printf "cert-manager is either not installed or not ready. Please install cert-manager or wait until it becomes ready.\nInstallation instructions can be found here: https://cert-manager.io/docs/installation/\n\n" && exit 1)
	@echo "cert-manager is installed and ready."

## Location to install dependencies to
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

## Tool Binaries
TILT ?= $(LOCALBIN)/tilt
CMCTL ?= $(LOCALBIN)/cmctl

## Tool Versions
TILT_VERSION := 0.33.22
CMCTL_VERSION := 2.1.1

.PHONY: cmctl
.PHONY: $(CMCTL)
cmctl: $(CMCTL)
$(CMCTL): $(LOCALBIN)
	test -s $(LOCALBIN)/cmctl || curl -fsSL https://github.com/cert-manager/cmctl/releases/download/v$(CMCTL_VERSION)/cmctl_$(real_OS)_$(goarch).tar.gz | tar -xz -C $(LOCALBIN) cmctl

.PHONY: tilt
.PHONY: $(TILT)
tilt: $(TILT)
$(TILT): $(LOCALBIN)
	test -s $(LOCALBIN)/tilt || curl -fsSL https://github.com/tilt-dev/tilt/releases/download/v$(TILT_VERSION)/tilt.$(TILT_VERSION).$(detected_OS).$(arch).tar.gz | tar -xz -C $(LOCALBIN) tilt

tilt-up: tilt check-cert-manager
	$(LOCALBIN)/tilt up

tilt-down: tilt cleanup-crds
	$(LOCALBIN)/tilt down
