#!/usr/bin/env bash

# Cluster readiness script for e2e testing
# Verifies that all workspace components are deployed and responsive
#   1. Rollout status checks for all deployments
#   2. TLS handshake verification for the controller webhook (via openssl)
#   3. HTTP endpoint verification for health/readiness probes (via curl)
#   4. Istio gateway routing verification (traffic flows through ingress gateway)

set -euo pipefail
trap 'jobs -p | xargs -r kill 2>/dev/null || true' EXIT

NAMESPACE="kubeflow-workspaces"
TIMEOUT="120s"

DEPLOYMENTS=(
  "workspaces-controller"
  "workspaces-backend"
  "workspaces-frontend"
)

check_rollout_status() {
  local deployment="$1"
  echo "Checking rollout status for ${deployment}..."
  if ! kubectl rollout status "deployment/${deployment}" -n "${NAMESPACE}" --timeout="${TIMEOUT}"; then
    echo "✗ ERROR: Deployment ${deployment} failed rollout status check"
    kubectl get pods -n "${NAMESPACE}" -l app="${deployment}" -o wide || true
    return 1
  fi
  echo "✓ ${deployment} rollout complete"
}

# Port-forward and curl an HTTP endpoint
# Arguments:
#   $1 - label for log output
#   $2 - port-forward target (e.g., "svc/workspaces-backend" or "deployment/workspaces-controller")
#   $3 - target port
#   $4 - probe path
check_http_endpoint() {
  local label="$1"
  local pf_target="$2"
  local target_port="$3"
  local probe_path="$4"
  local local_port
  local pf_pid

  # Pick a random local port to avoid collisions
  local_port=$((RANDOM % 50000 + 10000))

  echo "Checking HTTP endpoint for ${label} (${probe_path})..."

  # Start port-forward in the background
  kubectl port-forward "${pf_target}" "${local_port}:${target_port}" -n "${NAMESPACE}" &
  pf_pid=$!

  # Ensure we clean up the port-forward on exit from this function
  trap "kill ${pf_pid} 2>/dev/null || true; trap - RETURN" RETURN

  # Wait for port-forward to be ready, then verify a successful response
  local http_code
  http_code=$(curl --silent --output /dev/null --write-out "%{http_code}" \
    --retry 10 --retry-delay 2 --retry-all-errors \
    "http://localhost:${local_port}${probe_path}")

  if [ "${http_code}" -ge 200 ] && [ "${http_code}" -lt 400 ]; then
    echo "✓ ${label} HTTP endpoint returned ${http_code}"
  else
    echo "✗ ERROR: ${label} HTTP endpoint returned ${http_code}"
    return 1
  fi
}

# Port-forward and verify TLS handshake via openssl s_client
# Arguments:
#   $1 - label for log output
#   $2 - port-forward target (e.g., "svc/webhook-service")
#   $3 - target port
check_tls_endpoint() {
  local label="$1"
  local pf_target="$2"
  local target_port="$3"
  local local_port
  local pf_pid

  # Pick a random local port to avoid collisions
  local_port=$((RANDOM % 50000 + 10000))

  echo "Checking TLS handshake for ${label}..."

  # Start port-forward in the background
  kubectl port-forward "${pf_target}" "${local_port}:${target_port}" -n "${NAMESPACE}" &
  pf_pid=$!

  # Ensure we clean up the port-forward on exit from this function
  trap "kill ${pf_pid} 2>/dev/null || true; trap - RETURN" RETURN

  # Wait for port-forward to be ready
  local retries=0
  local max_retries=10
  while ! echo | openssl s_client -connect "localhost:${local_port}" 2>/dev/null | grep -q "Verify return code:"; do
    retries=$((retries + 1))
    if [ ${retries} -ge ${max_retries} ]; then
      echo "✗ ERROR: ${label} TLS handshake failed after ${max_retries} attempts"
      return 1
    fi
    sleep 2
  done

  echo "✓ ${label} TLS handshake succeeded"
}

# Port-forward to istio ingress gateway and verify routing via HTTPS
# Arguments:
#   $1 - label for log output
#   $2 - request path (as defined in VirtualService)
check_gateway_route() {
  local label="$1"
  local request_path="$2"
  local local_port
  local pf_pid

  # Pick a random local port to avoid collisions
  local_port=$((RANDOM % 50000 + 10000))

  echo "Checking gateway route for ${label} (${request_path})..."

  # Port-forward to the istio ingress gateway in istio-system
  kubectl port-forward "svc/istio-ingressgateway" "${local_port}:443" -n istio-system &
  pf_pid=$!

  trap "kill ${pf_pid} 2>/dev/null || true; trap - RETURN" RETURN

  # Wait for port-forward to be ready and verify routing
  local http_code
  http_code=$(curl --silent --insecure --output /dev/null --write-out "%{http_code}" \
    --retry 10 --retry-delay 2 --retry-all-errors \
    "https://localhost:${local_port}${request_path}")

  if [ "${http_code}" -ge 200 ] && [ "${http_code}" -lt 400 ]; then
    echo "✓ ${label} gateway route returned ${http_code}"
  else
    echo "✗ ERROR: ${label} gateway route returned ${http_code}"
    return 1
  fi
}

echo "=== Cluster Readiness: Rollout Status ==="
for deployment in "${DEPLOYMENTS[@]}"; do
  check_rollout_status "${deployment}"
done

echo ""
echo "=== Cluster Readiness: Endpoints ==="

# Controller: webhook TLS (verify cert-manager certs are provisioned and server is listening)
check_tls_endpoint "controller webhook" "svc/workspaces-webhook-service" 443

# Controller: health endpoint (HTTP via pod, no service exposed for this port)
check_http_endpoint "controller health" "deployment/workspaces-controller" 8081 "/readyz"

# Backend: API healthcheck (HTTP via service)
check_http_endpoint "backend" "svc/workspaces-backend" 4000 "/api/v1/healthcheck"

# Frontend: UI (HTTP via service)
check_http_endpoint "frontend" "svc/workspaces-frontend" 8080 "/"

echo ""
echo "=== Cluster Readiness: Gateway Routing ==="

# Verify traffic routes through istio ingress gateway via HTTPS
check_gateway_route "backend via gateway" "/workspaces/api/v1/healthcheck"
check_gateway_route "frontend via gateway" "/workspaces/"

echo ""
echo "✓ All cluster readiness checks passed"
