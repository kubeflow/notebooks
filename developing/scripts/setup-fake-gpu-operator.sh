#!/usr/bin/env bash

# Setup script for the run-ai/fake-gpu-operator (FGO).
# This installs FGO into the Kind cluster so GPU workspaces (e.g. the sample
# `big_gpu` podConfig) can schedule and run without real GPU hardware: FGO's
# device-plugin advertises `nvidia.com/gpu` capacity on the labeled worker and
# injects a fake `nvidia-smi` into GPU pods.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FGO_CHART="oci://ghcr.io/run-ai/fake-gpu-operator/fake-gpu-operator"
FGO_VERSION="0.2.1"
# NOTE: This is important as the `nvidia-smi` from FGO hardcodes
# http://topology-server.gpu-operator
NAMESPACE="gpu-operator"

# Do nothing if ENABLE_FAKE_GPU is not set to true
if [[ "${ENABLE_FAKE_GPU:-false}" != "true" ]]; then
  echo ""
  echo ""
  echo "INFO: fake-gpu-operator setup is disabled. Set ENABLE_FAKE_GPU=true to enable."
  echo ""
  echo ""
  exit 0
fi

# helm is only required for the GPU path, so we check for it here rather than
# as a global prerequisite.
if ! command -v helm >/dev/null 2>&1; then
  echo "ERROR: helm is required for ENABLE_FAKE_GPU=true. Please install helm first:"
  echo "  https://helm.sh/docs/intro/install/"
  exit 1
fi

# ================================
# Label the worker node(s)
# ================================
# FGO assigns nodes to the "integration" pool (see fgo.values.yaml) by this
# label. Applied at runtime; no node recreate is needed.
echo "Labeling worker node(s) for the 'integration' GPU node pool..."
kubectl label node -l '!node-role.kubernetes.io/control-plane' \
  run.ai/simulated-gpu-node-pool=integration --overwrite

# ================================
# Install the fake-gpu-operator
# ================================
echo "Installing/upgrading fake-gpu-operator (${FGO_VERSION})..."
helm upgrade --install fgo "${FGO_CHART}" \
  --namespace "${NAMESPACE}" \
  --version "${FGO_VERSION}" \
  --values "${DEVELOPING_DIR}/manifests/fake-gpu-operator/fgo.values.yaml" \
  --create-namespace \
  --wait \
  --timeout 120s

# ================================
# Wait for GPU capacity to appear
# ================================
echo "Waiting for the worker to advertise nvidia.com/gpu capacity..."
until kubectl get node \
    -l run.ai/simulated-gpu-node-pool=integration \
    --timeout=180s \
    -o jsonpath='{.items[0].status.capacity.nvidia\.com/gpu}' 2>/dev/null | grep -q '[1-9]'; do
  echo "... (no GPU capacity yet)"
  sleep 3
done

echo "fake-gpu-operator setup complete"
kubectl get nodes -o custom-columns=NAME:.metadata.name,GPU:'.status.capacity.nvidia\.com/gpu'
