#!/bin/bash

set -euo pipefail

echo "--- Installing cert-manager ---"
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s

VERSION=$(kubectl get deployment cert-manager -n cert-manager -o jsonpath="{.spec.template.spec.containers[0].image}" | cut -d: -f2)
echo "Cert Manager installed. Version: $VERSION"
