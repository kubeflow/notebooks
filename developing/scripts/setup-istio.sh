#!/usr/bin/env bash

# Setup script for Istio service mesh
# This script checks if Istio is installed and installs it if needed.
# Gateway resources (namespace, TLS cert, Gateway) are managed by Tilt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${DEVELOPING_DIR}/bin"

ISTIO_VERSION="1.29.1"
ISTIO_URL="https://istio.io/downloadIstio"

if [[ ! -d "${LOCALBIN}" ]]; then
  echo "INFO: Creating local bin directory at ${LOCALBIN}"
  mkdir -p "${LOCALBIN}"
fi

ISTIOCTL_PATH="${LOCALBIN}/istio-${ISTIO_VERSION}"
if [[ ! -d "${ISTIOCTL_PATH}" ]]; then
  pushd "$LOCALBIN" > /dev/null
    echo "INFO: Fetching Istio ${ISTIO_VERSION} installer..."
    curl -sL "$ISTIO_URL" | ISTIO_VERSION=${ISTIO_VERSION} sh -
  popd
fi

# Add istioctl to PATH for this script
export PATH=${ISTIOCTL_PATH}/bin:$PATH

# Ensure istioctl is available
if ! command -v istioctl >/dev/null 2>&1; then
  echo "ERROR: istioctl not found in PATH. Try removing ${LOCALBIN} and re-running."
  exit 1
else
  echo "INFO: using istioctl from $(which istioctl)"
  echo "INFO: istioctl version output:"
  istioctl version --remote=false
fi

echo "INFO: Installing Istio ${ISTIO_VERSION} ..."
istioctl install \
  --filename "${DEVELOPING_DIR}/manifests/istio-install-values.yaml" \
  --skip-confirmation

# Note: Gateway resources (namespace, TLS certificate, Gateway) are applied
# by Tilt from developing/manifests/istio-gateway/ via kustomize.
echo "INFO: Istio setup complete"
