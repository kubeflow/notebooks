#!/bin/bash

set -euo pipefail

echo "--- Installing metrics-server ---"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

#Do not verify the CA of serving certificates presented by Kubelets. For testing purposes only.
kubectl patch deployment metrics-server --namespace kube-system --type='json' --patch='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

kubectl wait --for=condition=Available deployment/metrics-server -n kube-system --timeout=300s

VERSION=$(kubectl get deployment metrics-server -n kube-system -o jsonpath="{.spec.template.spec.containers[0].image}" | cut -d: -f2)
echo "Metrics Server installed. Version: $VERSION"
