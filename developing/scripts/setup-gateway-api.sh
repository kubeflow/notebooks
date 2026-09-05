#!/usr/bin/env bash

set -euo pipefail

# Must stay compatible with the sigs.k8s.io/gateway-api version in
# workspaces/controller/go.mod.
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-v1.6.1}"

# The ExternalAuth filter (GEP-1494) is an experimental feature, so the
# ext-authz flavor needs the experimental channel.
GATEWAY_API_CHANNEL="${GATEWAY_API_CHANNEL:-standard}"

INSTALL_URL="https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/${GATEWAY_API_CHANNEL}-install.yaml"

bundle_annotation='{.metadata.annotations.gateway\.networking\.k8s\.io/bundle-version}'
channel_annotation='{.metadata.annotations.gateway\.networking\.k8s\.io/channel}'
installed_version="$(kubectl get crd httproutes.gateway.networking.k8s.io -o jsonpath="${bundle_annotation}" 2>/dev/null || true)"
installed_channel="$(kubectl get crd httproutes.gateway.networking.k8s.io -o jsonpath="${channel_annotation}" 2>/dev/null || true)"

if [[ "${installed_version}" == "${GATEWAY_API_VERSION}" && "${installed_channel}" == "${GATEWAY_API_CHANNEL}" ]]; then
  echo "Gateway API ${GATEWAY_API_VERSION} (${GATEWAY_API_CHANNEL} channel) is already installed"
else
  if [[ -n "${installed_version}" ]]; then
    echo "Replacing Gateway API ${installed_version} (${installed_channel:-unknown} channel)"
  fi
  echo "Installing Gateway API ${GATEWAY_API_VERSION} (${GATEWAY_API_CHANNEL} channel)..."
  kubectl apply --server-side --force-conflicts -f "${INSTALL_URL}"
fi

echo "Gateway API setup complete"
