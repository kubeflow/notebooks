#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="${SCRIPT_DIR}/../e2e"
KUBECTL="${KUBECTL:-kubectl}"
GATEWAY_PORT="${GATEWAY_PORT:-8443}"

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

# wait for port-forward to be ready
for i in $(seq 1 10); do
  if curl -sk "https://localhost:${GATEWAY_PORT}/workspaces/api/v1/healthcheck" >/dev/null 2>&1; then
    echo "✓ Gateway port-forward ready"
    break
  fi
  if [[ $i -eq 10 ]]; then
    echo "✗ ERROR: Gateway port-forward failed to become ready"
    exit 1
  fi
  sleep 2
done

echo "Installing e2e test dependencies..."
cd "${E2E_DIR}"
npm ci --prefer-offline 2>/dev/null || npm install
npx cypress verify >/dev/null

echo "Running Cypress e2e tests..."
CYPRESS_BASE_URL="https://localhost:${GATEWAY_PORT}/workspaces" \
  npx cypress run --browser chrome

echo "✓ E2E tests complete"
