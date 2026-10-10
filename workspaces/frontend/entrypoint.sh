#!/bin/sh
set -e

# Strictly validate DEPLOYMENT_MODE to prevent injection; default to kubeflow
case "${DEPLOYMENT_MODE}" in
  standalone)
    DEPLOYMENT_MODE="standalone"
    ;;
  *)
    DEPLOYMENT_MODE="kubeflow"
    ;;
esac
export DEPLOYMENT_MODE

# Preserve original template for idempotent container restarts
if [ ! -f /usr/share/nginx/html/index.html.template ]; then
  cp /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.template
fi

# Substitute only ${DEPLOYMENT_MODE} into index.html
envsubst '${DEPLOYMENT_MODE}' < /usr/share/nginx/html/index.html.template > /usr/share/nginx/html/index.html

exec "$@"
