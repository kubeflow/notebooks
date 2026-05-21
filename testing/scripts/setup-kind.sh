#!/usr/bin/env bash

# Setup script for Kind cluster
# This script checks if a Kind cluster exists and creates it if needed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CLUSTER_NAME="local-e2e"
KIND_CONFIG="${TESTING_DIR}/kind-1-35.yaml"

# Check if kind command exists
if ! command -v kind >/dev/null 2>&1; then
  echo "ERROR: kind is not installed. Please install kind first:"
  echo "  brew install kind  # macOS"
  echo "  or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  exit 1
fi

# Check if cluster exists
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "INFO: creating Kind cluster '${CLUSTER_NAME}' with config from '${KIND_CONFIG}'"
  kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG}" --wait 60s
else
  echo "INFO: kind cluster '${CLUSTER_NAME}' already exists"
fi

# Ensure kubectl context is set to the Kind cluster
kubectl config use-context "kind-${CLUSTER_NAME}" || {
  echo "ERROR: failed to set kubectl context to kind-${CLUSTER_NAME}"
  exit 1
}

echo "INFO: kind cluster setup complete"
