#!/usr/bin/env bash

set -euo pipefail

if (( $# != 3 )); then
  echo "Usage: $0 <repository> <base-branch> <head-branch>" >&2
  exit 2
fi

repository="$1"
base_branch="$2"
head_branch="$3"

branch_prefix="automation/frontend-api-sync-"

if [[ "${head_branch}" != "${branch_prefix}"* ]]; then
  echo "ERROR: refusing unexpected branch '${head_branch}'." >&2
  exit 1
fi

gh pr create \
  --repo "${repository}" \
  --base "${base_branch}" \
  --head "${head_branch}" \
  --title "chore: sync frontend API client" \
  --body "$(cat <<'BODY'
## What

Automatically synchronize the frontend API client with the latest committed backend Swagger.

This PR updates:

- `workspaces/frontend/scripts/swagger.version`
- generated frontend API files
- the generated WorkspaceKind JSON schema, when needed

## Review

This PR is intentionally human-reviewed and human-merged.

If generated API changes require compatibility fixes, maintainers can push those fixes directly to this branch. A later Swagger update will reuse the same open sync PR and preserve those commits.
BODY
)"
