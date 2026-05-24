#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=$1
INGRESS_IP=$2

echo "--- Testing JS/Node.js Client ---"

# Setup temporary package workspace
echo "Setting up local Node.js environment..."
rm -rf node_modules package.json package-lock.json
npm init -y --scope=test >/dev/null
npm install --quiet ws argparse >/dev/null

# Run SSH E2E connection using ws package based WebSocket client
set +e
SSH_OUTPUT=$(ssh -v -i id_smoke \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=10 \
  -o ProxyCommand="env NODE_TLS_REJECT_UNAUTHORIZED=0 node smoke_client.js -namespace $NAMESPACE -workspace ssh-smoke-ws -port 2222 -server https://$INGRESS_IP/workspaces" \
  jovyan@ssh-smoke-ws "echo 'SUCCESSFUL_SSH_CONNECTION'" 2>&1)
set -e

rm -rf node_modules package.json package-lock.json

if echo "$SSH_OUTPUT" | grep -q "SUCCESSFUL_SSH_CONNECTION"; then
  echo "✓ JS Client: SUCCESS"
else
  echo "✗ JS Client: FAILURE"
  echo "=== JS Client SSH Verbose Logs ==="
  echo "$SSH_OUTPUT"
  echo "=================================="
  exit 1
fi
