#!/usr/bin/env bash

# Setup script for the run-ai/fake-gpu-operator (FGO).
# This installs FGO into the Kind cluster so GPU workspaces (e.g. the sample
# `big_gpu` podConfig) can schedule and run without real GPU hardware: FGO's
# device-plugin advertises `nvidia.com/gpu` capacity on the labeled worker and
# injects a fake `nvidia-smi` into GPU pods.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Chart pinned during the validation spike (matches its published topology
# schema: topology.nodePools.<pool>.{gpuProduct,gpuCount,gpuMemory}).
FGO_CHART="oci://ghcr.io/run-ai/fake-gpu-operator/fake-gpu-operator"
FGO_VERSION="0.2.0"
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
# Sanity checks: refuse to run alongside a real NVIDIA GPU stack
# ================================
# FGO simulates GPUs at the API level. Co-installing it with the real NVIDIA
# GPU Operator or a real device plugin produces conflicting nvidia.com/gpu
# advertisements, so bail out (before mutating anything) if we detect one.

# 1. The real NVIDIA GPU Operator / device plugin ships these DaemonSets; FGO
#    never creates them (its own device-plugin DaemonSet is named "device-plugin").
if kubectl get daemonset --all-namespaces \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null \
  | grep -Eqx 'nvidia-driver-daemonset|nvidia-device-plugin-daemonset'; then
  echo "ERROR: a real NVIDIA GPU Operator / device plugin appears to be installed"
  echo "       (found an 'nvidia-driver-daemonset' or 'nvidia-device-plugin-daemonset')."
  echo "       Refusing to install the fake-gpu-operator alongside real GPU tooling."
  exit 1
fi

# 2. No node should already advertise nvidia.com/gpu capacity, unless it came
#    from a previous run of this script (i.e. our own FGO release exists). GPU
#    capacity on a node this script hasn't touched means real hardware or a real
#    device plugin is present.
if ! helm status fgo -n "${NAMESPACE}" >/dev/null 2>&1; then
  # `|| true` keeps `set -e`/`pipefail` from aborting when grep finds no GPU node.
  GPU_NODES="$(kubectl get nodes \
    -o jsonpath='{range .items[*]}{.metadata.name}={.status.capacity.nvidia\.com/gpu}{"\n"}{end}' 2>/dev/null \
    | grep -E '=[1-9][0-9]*$' | cut -d= -f1 | tr '\n' ' ' || true)"
  if [[ -n "${GPU_NODES// }" ]]; then
    echo "ERROR: node(s) already advertise nvidia.com/gpu capacity: ${GPU_NODES}"
    echo "       This script has not installed the fake-gpu-operator here, so real"
    echo "       GPUs or a real device plugin may be present. Refusing to continue."
    exit 1
  fi
fi

# ================================
# Namespace + Pod Security Admission
# ================================
# FGO's device-plugin runs privileged pods, so the namespace must permit them.
echo "Ensuring namespace '${NAMESPACE}' exists with privileged Pod Security..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace "${NAMESPACE}" \
  pod-security.kubernetes.io/enforce=privileged --overwrite

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
helm upgrade -i fgo "${FGO_CHART}" \
  --namespace "${NAMESPACE}" \
  --version "${FGO_VERSION}" \
  -f "${DEVELOPING_DIR}/manifests/fake-gpu-operator/fgo.values.yaml" \
  --wait

# ================================
# Wait for GPU capacity to appear
# ================================
echo "Waiting for the worker to advertise nvidia.com/gpu capacity..."
until kubectl get node -l run.ai/simulated-gpu-node-pool=integration \
  -o jsonpath='{.items[0].status.capacity.nvidia\.com/gpu}' 2>/dev/null | grep -q '[1-9]'; do
  echo "... (no GPU capacity yet)"
  sleep 3
done

echo "fake-gpu-operator setup complete"
kubectl get nodes -o custom-columns=NAME:.metadata.name,GPU:'.status.capacity.nvidia\.com/gpu'
