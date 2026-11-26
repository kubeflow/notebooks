#!/usr/bin/env bash
# Cypress e2e test runner.
#
# Usage: run-e2e.sh [run|open] [cypress args...]
#   run-e2e.sh                                          # run every spec headless
#   run-e2e.sh run --spec cypress/tests/workspace/user/list.cy.ts
#   run-e2e.sh open                                     # interactive runner
#
# If CYPRESS_BASE_URL is already set (e.g. for Tilt, or any other reachable
# Workspaces deployment), it's used as-is. Otherwise, this port-forwards the
# kind/Istio ingress gateway to produce one. Either way, the backend healthcheck
# must answer before Cypress starts. See testing/e2e/README.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="${SCRIPT_DIR}/../e2e"

GATEWAY_PORT="${GATEWAY_PORT:-8443}"

MODE="${1:-run}"
if [[ $# -gt 0 ]]; then
  shift
fi
case "${MODE}" in
  run | open) ;;
  *)
    echo "ERROR: unknown mode '${MODE}' (expected 'run' or 'open')"
    exit 1
    ;;
esac

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Port-forwards the kind/Istio ingress gateway to localhost:GATEWAY_PORT (stopped on exit).
start_istio_portforward() {
  if port_in_use "${GATEWAY_PORT}"; then
    echo "ERROR: localhost:${GATEWAY_PORT} is already in use, so the gateway can't be port-forwarded."
    echo "  If Tilt (or another deployment) is serving there, point the tests at it instead:"
    echo "    CYPRESS_BASE_URL=https://localhost:${GATEWAY_PORT}/workspaces E2E_ALLOWED_CONTEXTS=kind-tilt \\"
    echo "      bash testing/scripts/run-e2e.sh"
    echo "  Or pick a free port: GATEWAY_PORT=9443 bash testing/scripts/run-e2e.sh"
    exit 1
  fi

  cleanup() {
    if [[ -n "${PORT_FORWARD_PID:-}" ]]; then
      echo "INFO: Stopping port-forward (PID ${PORT_FORWARD_PID})..."
      kill "${PORT_FORWARD_PID}" 2>/dev/null || true
      wait "${PORT_FORWARD_PID}" 2>/dev/null || true
    fi
  }
  trap cleanup EXIT

  echo "INFO: Starting Istio gateway port-forward on localhost:${GATEWAY_PORT}..."
  kubectl port-forward -n istio-system svc/istio-ingressgateway "${GATEWAY_PORT}:443" &
  PORT_FORWARD_PID=$!
}

# Fails fast if the deployment behind CYPRESS_BASE_URL isn't serving, instead of
# letting every spec time out.
wait_for_workspaces() {
  local healthcheck_url="${CYPRESS_BASE_URL%/}/api/v1/healthcheck"

  echo "INFO: Waiting for ${healthcheck_url}..."
  if ! curl --silent --insecure --output /dev/null --fail \
      --retry 10 --retry-delay 2 --retry-all-errors \
      "${healthcheck_url}"; then
    echo "ERROR: ${healthcheck_url} isn't responding."
    if [[ -n "${PORT_FORWARD_PID:-}" ]]; then
      echo "  Check the gateway port-forward output above, and that the stack is deployed (make cluster-readiness)."
    else
      echo "  Check that CYPRESS_BASE_URL points at a running Workspaces deployment (ending in /workspaces)."
    fi
    exit 1
  fi
  echo "INFO: Workspaces is responding"
}

if [[ -z "${CYPRESS_BASE_URL:-}" ]]; then
  start_istio_portforward
  export CYPRESS_BASE_URL="https://localhost:${GATEWAY_PORT}/workspaces"
fi
wait_for_workspaces

echo "INFO: Installing e2e test dependencies..."
cd "${E2E_DIR}"
npm ci
# Some npm configurations skip install scripts, which is how Cypress normally fetches its binary.
npx cypress install

echo "INFO: Running Cypress (${MODE}) against ${CYPRESS_BASE_URL}..."
# Electron ships inside the Cypress binary (pinned by package-lock.json), so runs don't
# depend on whichever Chrome is installed locally or on the CI runner.
if [[ "${MODE}" == "open" ]]; then
  npx cypress open --e2e --browser electron "$@"
else
  npx cypress run --browser electron "$@"
fi

echo "INFO: E2E tests complete"
