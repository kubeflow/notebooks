#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=$1
INGRESS_IP=$2

echo "--- Testing Python Client ---"

# Setup clean Python virtual environment
echo "Setting up local Python virtual environment..."
rm -rf venv
python3 -m venv venv

# Install standard dependencies from requirements.txt using highly reproducible trusted public mirrors
echo "Installing E2E Python client dependencies..."
./venv/bin/pip install \
  --trusted-host pypi.org \
  --trusted-host files.pythonhosted.org \
  --index-url https://pypi.org/simple \
  --quiet -r requirements.txt

SSH_OUTPUT=$(ssh -i id_smoke \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=10 \
  -o ProxyCommand="./venv/bin/python3 smoke_client.py -namespace $NAMESPACE -workspace ssh-smoke-ws -port 2222 -server https://$INGRESS_IP/workspaces" \
  jovyan@ssh-smoke-ws "echo 'SUCCESSFUL_SSH_CONNECTION'")

rm -rf venv

if [ "$SSH_OUTPUT" = "SUCCESSFUL_SSH_CONNECTION" ]; then
  echo "✓ Python Client: SUCCESS"
else
  echo "✗ Python Client: FAILURE"
  exit 1
fi
