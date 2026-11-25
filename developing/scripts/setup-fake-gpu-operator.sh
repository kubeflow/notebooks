#!/usr/bin/env bash

# Setup script for the run-ai/fake-gpu-operator (FGO).
# This installs FGO into the Kind cluster so GPU workspaces (e.g. the sample
# `big_gpu` podConfig) can schedule and run without real GPU hardware: FGO's
# device-plugin advertises `nvidia.com/gpu` capacity on the labeled worker and
# injects a fake `nvidia-smi` into GPU pods.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${DEVELOPING_DIR}/bin"

HELM_VERSION="v4.3.2"

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

# ================================
# Fetch a pinned helm
# ================================
# helm is only needed for this (opt-in) path, so it is downloaded here, after
# the ENABLE_FAKE_GPU check, from the official release page.
HELM_DIR="${LOCALBIN}/helm-${HELM_VERSION}"
if [[ ! -x "${HELM_DIR}/helm" ]]; then
  HELM_OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "$(uname -m)" in
    x86_64 | amd64) HELM_ARCH="amd64" ;;
    aarch64 | arm64) HELM_ARCH="arm64" ;;
    *) echo "ERROR: unsupported architecture for helm download: $(uname -m)"; exit 1 ;;
  esac
  HELM_TARBALL="helm-${HELM_VERSION}-${HELM_OS}-${HELM_ARCH}.tar.gz"
  HELM_URL="https://get.helm.sh/${HELM_TARBALL}"

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "${TMP_DIR}"' EXIT

  echo "INFO: Downloading helm ${HELM_VERSION} from ${HELM_URL} ..."
  curl -fsSL -o "${TMP_DIR}/${HELM_TARBALL}" "${HELM_URL}"
  curl -fsSL -o "${TMP_DIR}/${HELM_TARBALL}.sha256sum" "${HELM_URL}.sha256sum"

  echo "INFO: Verifying helm checksum ..."
  # sha256sum on Linux, shasum on macOS
  if command -v sha256sum >/dev/null 2>&1; then
    SHA256_CHECK=(sha256sum -c)
  else
    SHA256_CHECK=(shasum -a 256 -c)
  fi
  (cd "${TMP_DIR}" && "${SHA256_CHECK[@]}" "${HELM_TARBALL}.sha256sum")

  tar -xzf "${TMP_DIR}/${HELM_TARBALL}" -C "${TMP_DIR}"
  mkdir -p "${HELM_DIR}"
  mv "${TMP_DIR}/${HELM_OS}-${HELM_ARCH}/helm" "${HELM_DIR}/helm"
fi

# Add helm to PATH for this script
export PATH="${HELM_DIR}:${PATH}"
echo "INFO: using helm from $(command -v helm) ($(helm version --short))"

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
