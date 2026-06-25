#!/usr/bin/env bash

# Setup script for prometheus-operator
# This script checks if prometheus-operator is installed and installs it if needed.
# It also deploys a minimal Prometheus instance for local development metrics verification.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Do nothing if ENABLE_PROMETHEUS is not set to true
if [[ "${ENABLE_PROMETHEUS:-false}" != "true" ]]; then
  echo ""
  echo ""
  echo "INFO: Prometheus setup is disabled. Set ENABLE_PROMETHEUS=true to enable."
  echo ""
  echo ""
  exit 0
fi

# ================================
# Install Prometheus Operator
# ================================
if kubectl get crd prometheuses.monitoring.coreos.com >/dev/null 2>&1; then
  echo "Prometheus Operator is already installed"
else
  echo "Installing Prometheus Operator..."
  # NOTE: we use server-side apply here because prometheus-operator has large CRDs,
  #       and otherwise we fail with "metadata.annotations: Too long: may not be more than 262144 bytes"
  kubectl apply --server-side=true -k "${DEVELOPING_DIR}/manifests/prometheus-operator"
fi

echo "Waiting for Prometheus Operator to be ready..."
kubectl wait --for=condition=ready pod \
  --selector app.kubernetes.io/name=prometheus-operator \
  --namespace=monitoring \
  --timeout=120s
kubectl wait endpointslice \
  --for="jsonpath=endpoints[0].targetRef.kind=Pod" \
  --selector app.kubernetes.io/name=prometheus-operator \
  --namespace=monitoring \
  --timeout=120s

echo "Waiting for ServiceMonitor CRD to be created..."
until kubectl get crd/servicemonitors.monitoring.coreos.com; do
  echo "... (not created yet)"
  sleep 2
done

echo "Waiting for CRDs to be established..."
kubectl wait --for=condition=established crd/prometheuses.monitoring.coreos.com --timeout=60s
kubectl wait --for=condition=established crd/servicemonitors.monitoring.coreos.com --timeout=60s

# ================================
# Deploy Prometheus Instance
# ================================

echo "Deploying Prometheus instance..."
kubectl apply -k "${DEVELOPING_DIR}/manifests/prometheus"

echo "Waiting for Prometheus to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=prometheus \
  --namespace=monitoring \
  --timeout=120s

echo "Prometheus setup complete"
