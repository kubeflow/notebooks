#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Kubeflow Workspaces Secure Tunneling E2E Testing Matrix ==="
NAMESPACE="ssh-smoke-test-ns"

# Ensure sub-scripts are executable
chmod +x test_go.sh test_python.sh test_js.sh

# Build the ws-port-forward Go binary client dynamically inside module context
echo "Compiling ws-port-forward proxy binary dynamically from source..."
(cd ../../workspaces/ws-port-forward && go build -o bin/ws-port-forward main.go)

# Build the SSH Smoke Test Docker image and load it into Kind
echo "Building ssh-smoke-image:e2e Docker image..."
docker build -t ssh-smoke-image:e2e -f ssh-smoke.Dockerfile .
echo "Loading ssh-smoke-image:e2e into local-e2e Kind cluster..."
kind load docker-image ssh-smoke-image:e2e --name local-e2e

# 1. Check and install cloud-provider-kind locally if missing
if ! command -v cloud-provider-kind >/dev/null 2>&1; then
  echo "Installing cloud-provider-kind dependency..."
  go install sigs.k8s.io/cloud-provider-kind@v0.7.0
fi

# 2. Start local cloud-provider-kind in the background
echo "Starting local cloud-provider-kind load balancer controller..."
$(go env GOPATH)/bin/cloud-provider-kind >/dev/null 2>&1 &
CPK_PID=$!

# 3. Generate SSH keys if not present
if [ ! -f id_smoke ]; then
  echo "Generating temporary SSH keypair..."
  ssh-keygen -t rsa -b 4096 -f id_smoke -N ""
fi

# 4. Ensure clean namespace and WorkspaceKind state
echo "Ensuring clean namespace state..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found=true --wait=true
kubectl delete workspacekind ssh-smoke-kind --ignore-not-found=true

# 5. Create and label the test namespace
echo "Creating test namespace: $NAMESPACE..."
kubectl create namespace "$NAMESPACE"
kubectl label namespace "$NAMESPACE" pod-security.kubernetes.io/enforce=restricted --overwrite
kubectl label namespace "$NAMESPACE" istio-injection=enabled --overwrite

# 6. Create ClusterRoleBinding to authorize the test identity
echo "Creating ClusterRoleBinding for notebooks-admin..."
kubectl create clusterrolebinding notebooks-admin-binding \
  --clusterrole=cluster-admin \
  --user=notebooks-admin \
  --dry-run=client -o yaml | kubectl apply -f -

# 7. Create the SSH Key Secret
echo "Creating Kubernetes SSH Key Secret..."
kubectl create secret generic kubeflow-ssh-pub-ssh-smoke-ws \
  -n "$NAMESPACE" \
  --from-file=authorized_keys=id_smoke.pub

# 8. Apply SSH WorkspaceKind and Workspace manifests
echo "Applying SSH WorkspaceKind and Workspace manifests..."
kubectl apply -f ../../workspaces/controller/manifests/kustomize/samples/common/workspace_service_account.yaml -n "$NAMESPACE"
kubectl apply -f ssh-smoke-workspacekind.yaml
kubectl apply -f ssh-smoke-workspace.yaml

# 9. Wait for the Pod to exist and become Ready
echo "Waiting for Workspace Pod to exist..."
POD_NAME=""
until [ -n "$POD_NAME" ]; do
  POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l "notebooks.kubeflow.org/workspace-name=ssh-smoke-ws" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  sleep 1
done
echo "Found Workspace Pod name: $POD_NAME"

echo "Waiting for Workspace Pod to become Ready..."
kubectl wait --namespace="$NAMESPACE" \
  --for=condition=Ready "pod/$POD_NAME" \
  --timeout=120s

# 10. Wait for LoadBalancer IP allocation on istio-ingressgateway
echo "Waiting for Ingress IngressGateway LoadBalancer External IP to be allocated..."
INGRESS_IP=""
until [ -n "$INGRESS_IP" ] && [ "$INGRESS_IP" != "<pending>" ]; do
  INGRESS_IP=$(kubectl get svc -n istio-system istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  sleep 1
done
echo "Successfully allocated Ingress LoadBalancer IP: $INGRESS_IP"

# Define clean cleanup function
cleanup() {
  echo "Cleaning up E2E resources..."
  kill -9 "$CPK_PID" >/dev/null 2>&1 || true
  rm -rf venv node_modules package.json package-lock.json
  kubectl delete clusterrolebinding notebooks-admin-binding --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl delete namespace "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl delete workspacekind ssh-smoke-kind --ignore-not-found=true >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Initialize test status tracking
GO_STATUS="FAILED"
PYTHON_STATUS="FAILED"
JS_STATUS="FAILED"

# Run JS Client Test
if ./test_js.sh "$NAMESPACE" "$INGRESS_IP"; then
  JS_STATUS="SUCCESS"
fi

# Run GO Client Test
if ./test_go.sh "$NAMESPACE" "$INGRESS_IP"; then
  GO_STATUS="SUCCESS"
fi

# Run Python Client Test
if ./test_python.sh "$NAMESPACE" "$INGRESS_IP"; then
  PYTHON_STATUS="SUCCESS"
fi

echo ""
echo "=========================================================="
echo "                 E2E SMOKE TEST MATRIX SUMMARY             "
echo "=========================================================="
echo "  GO Binary Client [ws-port-forward]:          $GO_STATUS"
echo "  Python Script Client [smoke_client.py]:      $PYTHON_STATUS"
echo "  Node.js/JS Script Client [smoke_client.js]:  $JS_STATUS"
echo "=========================================================="
echo ""

if [ "$GO_STATUS" = "SUCCESS" ] && [ "$PYTHON_STATUS" = "SUCCESS" ] && [ "$JS_STATUS" = "SUCCESS" ]; then
  echo "✓ ALL TARGET CONNECTIONS VERIFIED SUCCESSFULLY!"
else
  echo "✗ AT LEAST ONE REQUIRED CLIENT FLAVOR FAILED THE E2E CHECK!"
  exit 1
fi
