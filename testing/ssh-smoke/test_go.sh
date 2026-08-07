#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=$1
INGRESS_IP=$2

echo "--- Testing GO Binary Client ---"

# Build the ws-port-forward tool if missing
if [ ! -f ../../workspaces/ws-port-forward/bin/ws-port-forward ]; then
  echo "Building workspaces/ws-port-forward helper..."
  (cd ../../workspaces/ws-port-forward && go build -o bin/ws-port-forward main.go)
fi

SSH_OUTPUT=$(ssh -i id_smoke \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=10 \
  -o ProxyCommand="../../workspaces/ws-port-forward/bin/ws-port-forward -namespace $NAMESPACE -workspace ssh-smoke-ws -port 2222 -server https://$INGRESS_IP/workspaces" \
  jovyan@ssh-smoke-ws "echo 'SUCCESSFUL_SSH_CONNECTION'")

if [ "$SSH_OUTPUT" = "SUCCESSFUL_SSH_CONNECTION" ]; then
  echo "✓ GO Client: SUCCESS"
else
  echo "✗ GO Client: FAILURE"
  exit 1
fi
