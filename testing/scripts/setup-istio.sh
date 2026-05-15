#!/usr/bin/env bash
# Setup script for Istio service mesh
# This script checks if Istio is installed and installs it if needed.
# Gateway resources (namespace, TLS cert, Gateway) are applied directly
# (unlike developing/ which uses Tilt for this).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${TESTING_DIR}/bin"

# Require istioctl from LOCALBIN to ensure a known version
if [ -f "${LOCALBIN}/istioctl" ]; then
  ISTIOCTL="${LOCALBIN}/istioctl"
else
  echo "ERROR: istioctl is not installed. Please install istioctl first:"
  echo "  cd testing && make istioctl"
  exit 1
fi

# Check if Istio is already installed by verifying the full installation
if "${ISTIOCTL}" verify-install >/dev/null 2>&1; then
  echo "Istio is already installed"
else
  echo "Installing Istio with default profile..."
  "${ISTIOCTL}" install --set profile=default -y
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

# Apply gateway resources directly (in developing/ these are managed by Tilt)
kubectl create namespace kubeflow --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "${SCRIPT_DIR}/gateway-cert.yaml"
kubectl wait --for=condition=ready certificate/gateway-tls -n istio-system --timeout=60s
kubectl apply -f "${SCRIPT_DIR}/gateway.yaml"

echo "Istio setup complete"
