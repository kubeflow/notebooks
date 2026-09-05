#!/usr/bin/env bash

# Runtime wiring for the ext-authz flavor of the local environment.
#
# Three things cannot be expressed as static manifests:
#   - the session cookie key and OIDC client secret, which are generated
#   - the Gateway's self-signed CA, which cert-manager creates at runtime
#   - DNS for the issuer hostname, which has to resolve to the Gateway from
#     inside the cluster as well as from the browser

set -euo pipefail

ISSUER_HOST="${ISSUER_HOST:-kubeflow.example.com}"
GATEWAY_NAMESPACE="${GATEWAY_NAMESPACE:-kubeflow}"
WORKSPACES_NAMESPACE="${WORKSPACES_NAMESPACE:-kubeflow-workspaces}"
OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:-kubeflow-workspaces-dev-secret}"

kubectl create namespace "${WORKSPACES_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

echo "Creating the authorization service secret..."
cookie_key="$(head -c 32 /dev/urandom | base64 -w0)"
kubectl create secret generic workspaces-authz \
  --namespace "${WORKSPACES_NAMESPACE}" \
  --from-literal=COOKIE_KEY="${cookie_key}" \
  --from-literal=OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Waiting for the Gateway certificate..."
kubectl wait --namespace "${GATEWAY_NAMESPACE}" --for=condition=Ready certificate/gateway-tls --timeout=120s

echo "Copying the Gateway CA to ${WORKSPACES_NAMESPACE}..."
ca_crt="$(kubectl get secret gateway-tls-secret --namespace "${GATEWAY_NAMESPACE}" -o jsonpath='{.data.ca\.crt}')"
kubectl create secret generic gateway-tls-ca \
  --namespace "${WORKSPACES_NAMESPACE}" \
  --from-literal=ca.crt="$(echo "${ca_crt}" | base64 -d)" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Pointing ${ISSUER_HOST} at the Gateway for the authorization service..."
# The issuer URL must be the same string for the browser and for the
# authorization service. Rather than giving Dex a second, internal issuer, the
# one pod that needs it gets a host alias for the Gateway.
gateway_service=""
for _ in $(seq 1 30); do
  gateway_service="$(kubectl get service --namespace "${GATEWAY_NAMESPACE}" \
    -l gateway.networking.k8s.io/gateway-name=kubeflow-gateway \
    -o jsonpath='{.items[0].spec.clusterIP}' 2>/dev/null || true)"
  [[ -n "${gateway_service}" ]] && break
  sleep 2
done

if [[ -z "${gateway_service}" ]]; then
  echo "ERROR: could not find the Gateway service in namespace ${GATEWAY_NAMESPACE}" >&2
  echo "       the authorization service will not be able to reach the issuer" >&2
  exit 1
fi

kubectl patch deployment workspaces-authz \
  --namespace "${WORKSPACES_NAMESPACE}" \
  --type merge \
  -p "{\"spec\":{\"template\":{\"spec\":{\"hostAliases\":[{\"ip\":\"${gateway_service}\",\"hostnames\":[\"${ISSUER_HOST}\"]}]}}}}"

echo "ext-authz setup complete"
