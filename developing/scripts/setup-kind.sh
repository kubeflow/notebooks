#!/usr/bin/env bash
# Setup script for Kind cluster
# This script checks if a Kind cluster exists and creates it if needed

set -euo pipefail

CLUSTER_NAME="tilt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIND_CONFIG="${SCRIPT_DIR}/kind.yaml"

# Check if kind command exists
if ! command -v kind >/dev/null 2>&1; then
  echo "ERROR: kind is not installed. Please install kind first:"
  echo "  brew install kind  # macOS"
  echo "  or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  exit 1
fi

# Check if cluster exists
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "Creating Kind cluster '${CLUSTER_NAME}' with config from ${KIND_CONFIG}..."
  kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG}" --wait 60s
  echo "Kind cluster created successfully"
else
  echo "Kind cluster '${CLUSTER_NAME}' already exists"
fi

# Ensure kubectl context is set to the Kind cluster
kubectl config use-context "kind-${CLUSTER_NAME}" || true

echo "Kind cluster setup complete"
