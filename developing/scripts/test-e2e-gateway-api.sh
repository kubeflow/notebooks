#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTROLLER_DIR="$(cd "${DEVELOPING_DIR}/../workspaces/controller" && pwd)"

export ROUTING_PROVIDER="gateway-api"
export ISTIO_INSTALL_SKIP="true"

echo "Running Gateway API e2e tests..."
cd "${CONTROLLER_DIR}"
make test-e2e
