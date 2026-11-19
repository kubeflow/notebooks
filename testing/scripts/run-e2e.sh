#!/usr/bin/env bash
# Cypress e2e test runner.
#
# If CYPRESS_BASE_URL is already set (e.g. for Tilt, or any other reachable
# Workspaces deployment), it's used as-is. Otherwise, this falls back to
# port-forwarding the kind/Istio ingress gateway to produce one.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="${SCRIPT_DIR}/../e2e"

GATEWAY_PORT="${GATEWAY_PORT:-8443}"
KUBECTL="${KUBECTL:-kubectl}"

# Port-forwards the kind/Istio ingress gateway to localhost and sets
# CYPRESS_BASE_URL to it. Only called when CYPRESS_BASE_URL isn't already set.
start_istio_portforward() {
  cleanup() {
    if [[ -n "${PORT_FORWARD_PID:-}" ]]; then
      echo "  Stopping port-forward (PID ${PORT_FORWARD_PID})..."
      kill "${PORT_FORWARD_PID}" 2>/dev/null || true
      wait "${PORT_FORWARD_PID}" 2>/dev/null || true
    fi
  }
  trap cleanup EXIT

  echo "Starting Istio gateway port-forward on localhost:${GATEWAY_PORT}..."
  ${KUBECTL} port-forward -n istio-system svc/istio-ingressgateway "${GATEWAY_PORT}:443" &
  PORT_FORWARD_PID=$!

  echo "Waiting for gateway port-forward to be ready..."
  if ! curl --silent --insecure --output /dev/null --fail \
      --retry 10 --retry-delay 2 --retry-all-errors \
      "https://localhost:${GATEWAY_PORT}/workspaces/api/v1/healthcheck"; then
    echo "✗ ERROR: Gateway port-forward failed to become ready"
    exit 1
  fi
  echo "✓ Gateway port-forward ready"

  CYPRESS_BASE_URL="https://localhost:${GATEWAY_PORT}/workspaces"
}

if [[ -z "${CYPRESS_BASE_URL:-}" ]]; then
  start_istio_portforward
fi

echo "Installing e2e test dependencies..."
cd "${E2E_DIR}"
npm ci --prefer-offline 2>/dev/null || npm install
npx cypress verify >/dev/null

echo "Running Cypress e2e tests..."
CYPRESS_BASE_URL="${CYPRESS_BASE_URL}" \
  npx cypress run --browser chrome

echo "✓ E2E tests complete"
