#!/usr/bin/env bash

# Verify that the current kubectl context is a kind cluster.
# Checks both the context name (kind-* prefix) and the server URL (localhost).

set -euo pipefail

current_context=$(kubectl config current-context 2>/dev/null) || {
  echo "Error: Unable to get current kubectl context. Is kubectl configured?"
  exit 1
}

server_url=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null) || {
  echo "Error: Unable to get cluster server URL for context '${current_context}'"
  exit 1
}

context_check=0
server_check=0

if echo "${current_context}" | grep -qE '^kind-'; then
  context_check=1
fi

if echo "${server_url}" | grep -qE '(127\.0\.0\.1|localhost)'; then
  server_check=1
fi

if [ ${context_check} -ne 1 ] || [ ${server_check} -ne 1 ]; then
  echo "✗ ERROR: Current context '${current_context}' does not appear to be a kind cluster!"
  if [ ${context_check} -ne 1 ]; then
    echo "  ✗ Context name does not match kind-* pattern (got: ${current_context})"
  fi
  if [ ${server_check} -ne 1 ]; then
    echo "  ✗ Server URL does not use localhost/127.0.0.1 (got: ${server_url})"
  fi
  exit 1
fi
