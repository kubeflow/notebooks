#!/usr/bin/env bash

set -euo pipefail

if (( $# != 1 )); then
  echo "Usage: $0 <branch-name>" >&2
  exit 2
fi

branch_name="$1"
branch_prefix="automation/frontend-api-sync-"
remote="${SYNC_REMOTE:-origin}"

if [[ "${branch_name}" != "${branch_prefix}"* ]]; then
  echo "ERROR: refusing unexpected branch '${branch_name}'." >&2
  exit 1
fi

git add -A -- \
  workspaces/frontend/scripts/swagger.version \
  workspaces/frontend/src/generated \
  workspaces/frontend/src/app/pages/WorkspaceKinds/Form/yamlEditor/workspaceKindUpdateSchema.json

if ! git diff --cached --quiet; then
  git commit --signoff -m "chore: sync frontend API client"
else
  echo "No generated API changes to commit." >&2
fi

git push "${remote}" "${branch_name}"
