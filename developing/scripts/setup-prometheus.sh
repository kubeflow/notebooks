#!/usr/bin/env bash

# Setup script for Prometheus (prometheus-operator)
# Installs the Prometheus Operator via bundle.yaml and deploys a minimal
# Prometheus instance for local development metrics verification.
# Only used when ENABLE_PROMETHEUS=true.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROMETHEUS_OPERATOR_VERSION="v0.88.0"
BUNDLE_URL="https://github.com/prometheus-operator/prometheus-operator/releases/download/${PROMETHEUS_OPERATOR_VERSION}/bundle.yaml"
PROMETHEUS_NAMESPACE="prometheus-system"
PROMETHEUS_MANIFESTS="${DEVELOPING_DIR}/manifests/prometheus/prometheus.yaml"

# ---- Step 1: Install Prometheus Operator (CRDs + operator deployment) ----

if kubectl get crd prometheuses.monitoring.coreos.com >/dev/null 2>&1; then
  echo "Prometheus Operator CRDs already installed"
else
  echo "Installing Prometheus Operator ${PROMETHEUS_OPERATOR_VERSION}..."
  # NOTE: must use 'kubectl create' not 'kubectl apply' — bundle.yaml is too large
  # for client-side apply annotations.
  curl -sL "${BUNDLE_URL}" | kubectl create -f - 2>/dev/null || \
    echo "Prometheus Operator resources already exist (skipping)"
fi

echo "Waiting for Prometheus Operator to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=prometheus-operator \
  -n default \
  --timeout=120s

kubectl wait --for=condition=established crd/prometheuses.monitoring.coreos.com --timeout=60s
kubectl wait --for=condition=established crd/servicemonitors.monitoring.coreos.com --timeout=60s

# ---- Step 2: Deploy Prometheus instance ----

kubectl create namespace "${PROMETHEUS_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f "${PROMETHEUS_MANIFESTS}"

echo "Waiting for Prometheus to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=prometheus \
  -n "${PROMETHEUS_NAMESPACE}" \
  --timeout=120s

echo "Prometheus setup complete"
