#!/usr/bin/env bash

# Setup script for Kubeflow Community Distribution (KCD) components.
#
# Installs dex, oauth2-proxy, and the Kubeflow Central Dashboard into the
# local Kind cluster, mirroring the upstream community distribution layout.
# Pinned to release 26.03.1 of github.com/kubeflow/community-distribution.
#
# Default login credentials (from KCD static password config):
#   Email:    user@example.com
#   Password: 12341234
#
# This script is idempotent: re-running it on an existing cluster is safe.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVELOPING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCALBIN="${DEVELOPING_DIR}/bin"
KUSTOMIZE="${LOCALBIN}/kustomize"

KCD_VERSION="26.03.1"

if [[ ! -f "${KUSTOMIZE}" ]]; then
  echo "ERROR: kustomize not found at ${KUSTOMIZE}. Run 'make kustomize' first."
  exit 1
fi

echo "INFO: Installing KCD ${KCD_VERSION} components (dex, oauth2-proxy, dashboard)..."
echo "INFO: Downloading and applying manifests (this may take a moment on first run)..."

# Apply the main KCD components.
# NOTE: server-side apply avoids field ownership conflicts when kustomize-managed
# resources also appear in Tilt's resource list (e.g. the kubeflow namespace).
"${KUSTOMIZE}" build "${DEVELOPING_DIR}/manifests/kcd" \
  | kubectl apply --server-side -f -

# Wait for the auth layer to be ready.
echo "INFO: Waiting for dex to be ready..."
kubectl wait --for=condition=available deployment/dex \
  --namespace=auth --timeout=180s

echo "INFO: Waiting for oauth2-proxy to be ready..."
kubectl wait --for=condition=available deployment/oauth2-proxy \
  --namespace=oauth2-proxy --timeout=180s

# Wait for dashboard components.
echo "INFO: Waiting for profile-controller to be ready..."
kubectl wait --for=condition=available deployment/profiles-deployment \
  --namespace=kubeflow --timeout=180s

echo "INFO: Waiting for centraldashboard to be ready..."
kubectl wait --for=condition=available deployment/dashboard \
  --namespace=kubeflow --timeout=180s

# Create the default user profile.
# This is applied after the profile-controller is ready to ensure the
# profiles.kubeflow.org CRD is established before creating the Profile CR.
echo "INFO: Creating default user profile (user@example.com)..."
kubectl apply --server-side -f - <<EOF
apiVersion: kubeflow.org/v1beta1
kind: Profile
metadata:
  name: kubeflow-user-example-com
spec:
  owner:
    kind: User
    name: user@example.com
EOF

echo ""
echo "INFO: Kubeflow Community Distribution tilt setup complete."
echo ""
echo "  Login at: https://localhost:8443/"
echo "  Email:    user@example.com"
echo "  Password: 12341234"
echo ""
