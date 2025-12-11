#!/usr/bin/env bash
# Setup script for cert-manager
# This script checks if cert-manager is installed and installs it if needed
# Uses the same version as the e2e tests: v1.12.13 (LTS version)

set -euo pipefail

# Use LTS version of cert-manager (matches e2e tests)
CERT_MANAGER_VERSION="v1.12.13"
CERT_MANAGER_URL="https://github.com/jetstack/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"

# Check if cert-manager is already installed
if kubectl get crd certificates.cert-manager.io >/dev/null 2>&1; then
  echo "Cert-manager is already installed"
  exit 0
fi

echo "Installing cert-manager ${CERT_MANAGER_VERSION}..."
kubectl apply -f "${CERT_MANAGER_URL}"

echo "Waiting for cert-manager to be ready..."
# Wait for cert-manager webhook to be ready (this is the critical component)
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/instance=cert-manager \
  -n cert-manager \
  --timeout=120s || {
  echo "Warning: cert-manager pods may not be fully ready, but continuing..."
}

# Also wait for the CRDs to be established
kubectl wait --for=condition=established crd/certificates.cert-manager.io --timeout=60s || true
kubectl wait --for=condition=established crd/issuers.cert-manager.io --timeout=60s || true
kubectl wait --for=condition=established crd/clusterissuers.cert-manager.io --timeout=60s || true

echo "Cert-manager installation complete"
