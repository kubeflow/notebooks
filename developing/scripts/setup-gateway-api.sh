#!/usr/bin/env bash

set -euo pipefail

if kubectl get crd httproutes.gateway.networking.k8s.io >/dev/null 2>&1; then
  echo "Gateway API Standard CRDs are already installed"
else
  echo "Installing Gateway API CRDs..."
  kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml
fi

echo "Gateway API setup complete"
