#!/usr/bin/env bash

# Setup script for metrics-server
# This script checks if metrics-server is installed and installs it if needed.
# It lets developers verify `kubectl top` and the metrics.k8s.io APIService
# work end-to-end.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Do nothing if ENABLE_METRICS_SERVER is not set to true
if [[ "${ENABLE_METRICS_SERVER:-false}" != "true" ]]; then
  echo ""
  echo ""
  echo "INFO: metrics-server setup is disabled. Set ENABLE_METRICS_SERVER=true to enable."
  echo ""
  echo ""
  exit 0
fi

if kubectl get deployment metrics-server -n kube-system >/dev/null 2>&1; then
  echo "metrics-server is already installed"
else
  echo "Installing metrics-server..."
  kubectl apply -k "${DEVELOPING_DIR}/manifests/metrics-server"
fi

echo "Waiting for metrics-server to be ready..."
kubectl wait --for=condition=available deployment/metrics-server \
  --namespace=kube-system \
  --timeout=120s

echo "Waiting for the metrics.k8s.io APIService to become available..."
kubectl wait --for=condition=available apiservice/v1beta1.metrics.k8s.io --timeout=60s

echo "metrics-server setup complete"
