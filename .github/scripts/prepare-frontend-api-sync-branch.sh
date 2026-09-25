#!/usr/bin/env bash

set -euo pipefail

if (( $# != 3 )); then
  echo "Usage: $0 <existing:true|false> <branch-name> <base-sha>" >&2
  exit 2
fi

existing="$1"
branch_name="$2"
base_sha="$3"

remote="${SYNC_REMOTE:-origin}"
branch_prefix="automation/frontend-api-sync-"

if ! git rev-parse --verify --quiet "${base_sha}^{commit}" >/dev/null; then
  echo "ERROR: base SHA '${base_sha}' does not resolve to a commit." >&2
  exit 1
fi

case "${existing}" in
  true)
    if [[ -z "${branch_name}" ]]; then
      echo "ERROR: existing sync PR has no branch name." >&2
      exit 1
    fi

    if [[ "${branch_name}" != "${branch_prefix}"* ]]; then
      echo "ERROR: refusing unexpected branch '${branch_name}'." >&2
      exit 1
    fi

    echo "Preparing existing sync branch ${branch_name}." >&2

    git fetch "${remote}" \
        "+refs/heads/${branch_name}:refs/remotes/${remote}/${branch_name}" >&2

    git switch -C "${branch_name}" \
        "refs/remotes/${remote}/${branch_name}" >&2

    git merge --no-edit --signoff "${base_sha}" >&2
    ;;

  false)
    branch_name="${branch_prefix}${base_sha:0:8}"

    if git ls-remote --exit-code --heads "${remote}" "${branch_name}" >/dev/null 2>&1; then
        echo "Reusing existing automation branch ${branch_name}." >&2

        git fetch "${remote}" \
            "+refs/heads/${branch_name}:refs/remotes/${remote}/${branch_name}" >&2

        git switch -C "${branch_name}" \
            "refs/remotes/${remote}/${branch_name}" >&2

        git merge --no-edit --signoff "${base_sha}" >&2
    else
        echo "Creating new sync branch ${branch_name}." >&2

        git switch -c "${branch_name}" "${base_sha}" >&2
    fi
    ;;

  *)
    echo "ERROR: existing must be 'true' or 'false'." >&2
    exit 2
    ;;
esac

echo "branch_name=${branch_name}"
