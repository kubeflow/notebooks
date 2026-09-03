#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${DEVELOPING_DIR}/bin"

if [ -f "${LOCALBIN}/cloud-provider-kind" ]; then
  CLOUD_PROVIDER_KIND="${LOCALBIN}/cloud-provider-kind"
else
  echo "ERROR: cloud-provider-kind is not installed."
  exit 1
fi

echo "Starting cloud-provider-kind in the background..."
# Run cloud-provider-kind in background and detach
nohup "${CLOUD_PROVIDER_KIND}" --gateway-channel standard > "${DEVELOPING_DIR}/cloud-provider-kind.log" 2>&1 &
echo "cloud-provider-kind started. Logs are available in ${DEVELOPING_DIR}/cloud-provider-kind.log"
