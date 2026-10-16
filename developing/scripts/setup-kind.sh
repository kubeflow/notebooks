#!/usr/bin/env bash
# Setup script for Kind cluster
# This script checks if a Kind cluster exists and creates it if needed

set -euo pipefail

CLUSTER_NAME="tilt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
KIND_CONFIG="${DEVELOPING_DIR}/kind-1-35.yaml"

# Opt-in local container registry (see developing/.claude/docs/REGISTRY-PLAN.md).
# Works the same way regardless of container runtime (Docker or Podman): ctlptl
# creates the registry container via the active Docker-compatible API endpoint,
# and the Kind cluster/nodes are still created via the `kind` binary, which
# already honors KIND_EXPERIMENTAL_PROVIDER for Docker/Podman selection.
ENABLE_REGISTRY="${ENABLE_REGISTRY:-false}"
REGISTRY_NAME="${REGISTRY_NAME:-kubeflow-registry}"
# 5005 (not 5000) avoids a known macOS conflict: AirPlay Receiver/Control Center
# binds broadly to port 5000, which can intercept 'localhost:5000' traffic ahead
# of the registry container depending on IPv4/IPv6 resolution order.
REGISTRY_PORT="${REGISTRY_PORT:-5005}"

# Check if kind command exists
if ! command -v kind >/dev/null 2>&1; then
  echo "ERROR: kind is not installed. Please install kind first:"
  echo "  brew install kind  # macOS/Linux (Homebrew)"
  echo "  or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  exit 1
fi

if [ "${ENABLE_REGISTRY}" = "true" ]; then
  if ! command -v ctlptl >/dev/null 2>&1; then
    echo "ERROR: ctlptl is not installed, but ENABLE_REGISTRY=true requires it."
    echo "  brew install tilt-dev/tap/ctlptl  # macOS/Linux (Homebrew)"
    echo "  or visit: https://github.com/tilt-dev/ctlptl#how-do-i-install-it"
    exit 1
  fi

  # On macOS with the Podman Kind provider, ctlptl misidentifies the default
  # Docker-compatible socket (/var/run/docker.sock, which Podman's machine also
  # exposes) as Docker Desktop (see tilt-dev/ctlptl pkg/docker/docker.go
  # IsLocalDockerDesktop, which only does this broad check on darwin/windows).
  # That then calls a Docker-Desktop-only settings endpoint that doesn't exist
  # under Podman, failing `ctlptl apply` on every run. Point ctlptl at Podman's
  # own API socket instead so it's correctly treated as a plain remote Docker
  # host. This is resolved fresh on every run (never cached), is a no-op for
  # Docker, and a no-op for native Linux Podman (the ctlptl check above only
  # applies on darwin/windows; Linux's check only matches Docker Desktop's own
  # socket suffix, which Podman never uses).
  if [ "${KIND_EXPERIMENTAL_PROVIDER:-}" = "podman" ] && [ "$(uname -s)" = "Darwin" ] && [ -z "${DOCKER_HOST:-}" ]; then
    PODMAN_SOCKET="$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null || true)"
    if [ -n "${PODMAN_SOCKET}" ] && [ -S "${PODMAN_SOCKET}" ]; then
      export DOCKER_HOST="unix://${PODMAN_SOCKET}"
    else
      echo "WARNING: Could not resolve a live Podman machine API socket (is 'podman machine start' running?)."
      echo "         Continuing without a DOCKER_HOST override; 'ctlptl apply' may fail against Docker Desktop detection."
    fi
  fi

  echo "Ensuring Kind cluster '${CLUSTER_NAME}' with local registry '${REGISTRY_NAME}' (via ctlptl)..."

  # kindV1Alpha4Cluster expects only the body of a Kind v1alpha4 Cluster config
  # (no top-level apiVersion/kind), so strip those two keys from our existing
  # kind-1-35.yaml and embed the rest verbatim. This keeps kind-1-35.yaml as the
  # single source of truth for node images/kubeadm patches on both the plain
  # `kind create cluster` path (below) and this ctlptl path.
  CTLPTL_CONFIG="$(mktemp)"
  trap 'rm -f "${CTLPTL_CONFIG}"' EXIT

  {
    echo "apiVersion: ctlptl.dev/v1alpha1"
    echo "kind: Registry"
    echo "name: ${REGISTRY_NAME}"
    echo "port: ${REGISTRY_PORT}"
    # Fully-qualified image reference required for Podman compatibility: Podman's
    # Docker-API-compatible socket does not resolve unqualified image names the
    # way Docker does (see https://github.com/tilt-dev/ctlptl/issues/146). This
    # is a no-op for Docker, so it is safe to always set.
    echo "image: docker.io/library/registry:2"
    echo "---"
    echo "apiVersion: ctlptl.dev/v1alpha1"
    echo "kind: Cluster"
    echo "product: kind"
    echo "name: kind-${CLUSTER_NAME}"
    echo "registry: ${REGISTRY_NAME}"
    echo "kindV1Alpha4Cluster:"
    grep -Ev '^(apiVersion|kind):' "${KIND_CONFIG}" | sed 's/^/  /'
  } > "${CTLPTL_CONFIG}"

  # `ctlptl apply` is idempotent: it creates the registry/cluster if missing,
  # or ensures the existing ones match this config, and sets the kubectl context.
  ctlptl apply -f "${CTLPTL_CONFIG}"
  rm -f "${CTLPTL_CONFIG}"
  trap - EXIT
  echo "Kind cluster and local registry ready"
else
  # Check if cluster exists
  if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    echo "Creating Kind cluster '${CLUSTER_NAME}' with config from ${KIND_CONFIG}..."
    kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG}" --wait 60s
    echo "Kind cluster created successfully"
  else
    echo "Kind cluster '${CLUSTER_NAME}' already exists"
  fi
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
  "notebooks.kubeflow.org/can-use=true" \
  --overwrite
kubectl annotate storageclass standard \
  "notebooks.kubeflow.org/display-name=Standard (Local Path)" \
  "notebooks.kubeflow.org/description=Local path provisioner for development. Data is stored on the node and not replicated." \
  --overwrite

# Create an additional 'premium-local' StorageClass (same provisioner, but not usable, for testing)
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: premium-local
  labels:
    notebooks.kubeflow.org/can-use: "false"
  annotations:
    notebooks.kubeflow.org/display-name: "Premium Local (Local Path)"
    notebooks.kubeflow.org/description: "Simulated premium storage for development. Not enabled for use."
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
EOF

echo "Kind cluster setup complete"
