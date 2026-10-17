#!/usr/bin/env bash

set -euo pipefail

if (( $# != 2 )); then
  echo "Usage: $0 <repository> <base-branch>" >&2
  exit 2
fi

repository="$1"
base_branch="$2"
branch_prefix="automation/frontend-api-sync-"

sync_pr_output="$(
  gh pr list \
    --repo "${repository}" \
    --base "${base_branch}" \
    --state open \
    --limit 100 \
    --json number,headRefName,isCrossRepository \
    --jq ".[] |
      select(
        (.isCrossRepository == false) and
        (.headRefName | startswith(\"${branch_prefix}\"))
      ) |
      [.number, .headRefName] |
      @tsv"
)"

sync_prs=()

if [[ -n "${sync_pr_output}" ]]; then
  mapfile -t sync_prs <<< "${sync_pr_output}"
fi

if (( ${#sync_prs[@]} > 1 )); then
  echo "ERROR: found more than one open frontend API sync PR." >&2
  printf '  %s\n' "${sync_prs[@]}" >&2
  exit 1
fi

if (( ${#sync_prs[@]} == 1 )); then
  IFS=$'\t' read -r pr_number branch_name <<< "${sync_prs[0]}"

  echo "Found existing sync PR #${pr_number} on ${branch_name}." >&2

  echo "existing=true"
  echo "pr_number=${pr_number}"
  echo "branch_name=${branch_name}"
else
  echo "No existing frontend API sync PR found." >&2

  echo "existing=false"
  echo "pr_number="
  echo "branch_name="
fi
