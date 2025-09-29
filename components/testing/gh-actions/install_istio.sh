#!/bin/bash

set -euo pipefail

ISTIO_VERSION="1.17.8"
ISTIO_URL="https://istio.io/downloadIstio"

echo "Installing Istio ${ISTIO_VERSION} ..."
mkdir istio_tmp
pushd istio_tmp >/dev/null
    curl -sL "$ISTIO_URL" | ISTIO_VERSION=${ISTIO_VERSION} sh -
    cd istio-${ISTIO_VERSION}
    export PATH=$PWD/bin:$PATH
    
    # Install Istio with default profile
    istioctl install --set values.defaultRevision=default -y
    
    # Wait for Istio control plane to be ready
    kubectl wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=300s
    
    # Verify CRDs are installed
    kubectl get crd | grep istio
popd
