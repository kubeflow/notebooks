#!/usr/bin/env bash
# Setup script for Kind cluster
# This script checks if a Kind cluster exists and creates it if needed

set -euo pipefail

CLUSTER_NAME="tilt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
KIND_CONFIG="${DEVELOPING_DIR}/kind-1-35.yaml"
LOCALBIN="${DEVELOPING_DIR}/bin"

# Opt-in local container registry
ENABLE_REGISTRY="${ENABLE_REGISTRY:-false}"
REGISTRY_NAME="kubeflow-registry"
# NOTE: fully-qualified image name is required for Podman short-name resolution
# NOTE: changing the image makes ctlptl recreate the registry, dropping its cached layers
REGISTRY_IMAGE="docker.io/library/registry:2.8.3"
CTLPTL_VERSION="0.9.6"

# Check if kind command exists
if ! command -v kind >/dev/null 2>&1; then
  echo "ERROR: kind is not installed. Please install kind first:"
  echo "  brew install kind  # macOS"
  echo "  or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  exit 1
fi

if [[ "${ENABLE_REGISTRY}" == "true" ]]; then
  CTLPTL="${LOCALBIN}/ctlptl-${CTLPTL_VERSION}"
  if [[ ! -x "${CTLPTL}" ]]; then
    echo "INFO: Installing ctlptl ${CTLPTL_VERSION}..."
    GOBIN="${LOCALBIN}" go install "github.com/tilt-dev/ctlptl/cmd/ctlptl@v${CTLPTL_VERSION}"
    mv "${LOCALBIN}/ctlptl" "${CTLPTL}"
  fi

  # NOTE: on macOS, ctlptl mistakes Podman's Docker-compatible socket for Docker Desktop,
  #       so point it at Podman's native API socket instead
  if [[ "${KIND_EXPERIMENTAL_PROVIDER:-}" == "podman" && "$(uname -s)" == "Darwin" && -z "${DOCKER_HOST:-}" ]]; then
    PODMAN_SOCKET="$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null || true)"
    if [[ -S "${PODMAN_SOCKET}" ]]; then
      export DOCKER_HOST="unix://${PODMAN_SOCKET}"
    else
      echo "ERROR: Could not resolve the Podman machine API socket (is the Podman machine running?)"
      exit 1
    fi
  fi

  # NOTE: ctlptl recreates a stopped registry (losing its cached layers), so start it first
  "${KIND_EXPERIMENTAL_PROVIDER:-docker}" start "${REGISTRY_NAME}" >/dev/null 2>&1 || true

  echo "Ensuring Kind cluster '${CLUSTER_NAME}' is configured with local registry '${REGISTRY_NAME}'..."
  "${CTLPTL}" apply -f - <<EOF
apiVersion: ctlptl.dev/v1alpha1
kind: Registry
name: ${REGISTRY_NAME}
image: ${REGISTRY_IMAGE}
---
apiVersion: ctlptl.dev/v1alpha1
kind: Cluster
product: kind
name: kind-${CLUSTER_NAME}
registry: ${REGISTRY_NAME}
kindV1Alpha4Cluster:
$(sed 's/^/  /' "${KIND_CONFIG}")
EOF
  echo "Kind cluster and local registry ready"
elif ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "Creating Kind cluster '${CLUSTER_NAME}' with config from ${KIND_CONFIG}..."
  kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG}" --wait 60s
  echo "Kind cluster created successfully"
else
  echo "Kind cluster '${CLUSTER_NAME}' already exists"
fi

# Ensure kubectl context is set to the Kind cluster
kubectl config use-context "kind-${CLUSTER_NAME}" || {
  echo "ERROR: Failed to set kubectl context to kind-${CLUSTER_NAME}"
  exit 1
}

# Configure StorageClasses with Notebooks labels and annotations
echo "Configuring StorageClasses for the Notebooks UI..."

# Label and annotate the default 'standard' StorageClass
kubectl label storageclass standard \
  "workspaces.kubeflow.org/can-use=true" \
  --overwrite
kubectl annotate storageclass standard \
  "workspaces.kubeflow.org/display-name=Standard (Local Path)" \
  "workspaces.kubeflow.org/description=Local path provisioner for development. Data is stored on the node and not replicated." \
  --overwrite

# Create an additional 'premium-local' StorageClass (same provisioner, but not usable, for testing)
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: premium-local
  labels:
    workspaces.kubeflow.org/can-use: "false"
  annotations:
    workspaces.kubeflow.org/display-name: "Premium Local (Local Path)"
    workspaces.kubeflow.org/description: "Simulated premium storage for development. Not enabled for use."
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
EOF

echo "Kind cluster setup complete"
