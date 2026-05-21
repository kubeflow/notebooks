#!/usr/bin/env bash

# Setup script for Istio service mesh
# This script checks if Istio is installed and installs it if needed.
# Gateway resources (namespace, TLS cert, Gateway) are managed by Tilt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${DEVELOPING_DIR}/bin"

# Require istioctl from LOCALBIN to ensure a known version
if [ -f "${LOCALBIN}/istioctl" ]; then
  ISTIOCTL="${LOCALBIN}/istioctl"
else
  echo "ERROR: istioctl is not installed. Please install istioctl first:"
  echo "  cd developing && make istioctl"
  exit 1
fi

# Check if Istio is already installed by verifying the full installation
if "${ISTIOCTL}" verify-install >/dev/null 2>&1; then
  echo "Istio is already installed"
else
  echo "Installing Istio with default profile and CNI plugin..."
  "${ISTIOCTL}" install --set profile=default --set components.cni.enabled=true -y
fi

echo "Waiting for Istio control plane to be ready..."
kubectl wait --for=condition=ready pod \
  -l app=istiod \
  -n istio-system \
  --timeout=120s

echo "Waiting for Istio ingress gateway to be ready..."
kubectl wait --for=condition=ready pod \
  -l app=istio-ingressgateway \
  -n istio-system \
  --timeout=120s

# Note: Gateway resources (namespace, TLS certificate, Gateway) are applied
# by Tilt from developing/manifests/istio-gateway/ via kustomize.
echo "Istio setup complete"