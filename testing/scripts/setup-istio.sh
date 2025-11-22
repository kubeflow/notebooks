#!/usr/bin/env bash

# Setup script for Istio
# This script checks if Istio is installed and installs it if needed
# Uses istioctl to install the default profile

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${TESTING_DIR}/bin"

# Determine istioctl path - prefer LOCALBIN, fallback to PATH
if [ -f "${LOCALBIN}/istioctl" ]; then
  ISTIOCTL="${LOCALBIN}/istioctl"
elif command -v istioctl >/dev/null 2>&1; then
  ISTIOCTL="istioctl"
else
  echo "ERROR: istioctl is not installed. Please install istioctl first:"
  echo "  cd testing && make istioctl"
  echo "  or visit: https://istio.io/latest/docs/setup/getting-started/#download"
  exit 1
fi

# Check if Istio is already installed
# Check for istio-system namespace or istio CRDs
if kubectl get namespace istio-system >/dev/null 2>&1 && \
   kubectl get crd virtualservices.networking.istio.io >/dev/null 2>&1; then
  echo "Istio is already installed"
  exit 0
fi

echo "Installing Istio with default profile..."
"${ISTIOCTL}" install --set profile=default -y

echo "Waiting for Istio to be ready..."
# Wait for istiod to be ready
kubectl wait --for=condition=ready pod \
  -l app=istiod \
  -n istio-system \
  --timeout=120s || {
  echo "Warning: Istio pods may not be fully ready, but continuing..."
}

# Wait for istio ingress gateway to be ready (if present)
kubectl wait --for=condition=ready pod \
  -l app=istio-ingressgateway \
  -n istio-system \
  --timeout=120s || {
  echo "Warning: Istio ingress gateway may not be ready, but continuing..."
}

echo "Istio installation complete"

