#!/usr/bin/env bash

set -euo pipefail

if (( $# != 1 )); then
  echo "Usage: $0 <backend-commit-sha>" >&2
  exit 2
fi

backend_sha="$1"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend_dir="$(cd "${script_dir}/.." && pwd)"
repo_root="$(git -C "${frontend_dir}" rev-parse --show-toplevel)"
version_file="${script_dir}/swagger.version"

printf '%s\n' "${backend_sha}" > "${version_file}"

(
  cd "${frontend_dir}"
  npm run generate:api
)

tracked_changes="$(
  git -C "${repo_root}" diff --name-only
)"

untracked_changes="$(
  git -C "${repo_root}" ls-files --others --exclude-standard
)"

changed_output="$(
  printf '%s\n%s\n' \
    "${tracked_changes}" \
    "${untracked_changes}" |
    sed '/^$/d' |
    sort -u
)"

changed_files=()

if [[ -n "${changed_output}" ]]; then
  mapfile -t changed_files <<< "${changed_output}"
fi

unexpected_files=()

for file in "${changed_files[@]}"; do
  case "${file}" in
    workspaces/frontend/scripts/swagger.version \
    | workspaces/frontend/src/generated/* \
    | workspaces/frontend/src/app/pages/WorkspaceKinds/Form/yamlEditor/workspaceKindUpdateSchema.json)
      ;;
    *)
      unexpected_files+=("${file}")
      ;;
  esac
done

if (( ${#unexpected_files[@]} > 0 )); then
  echo "::error::API sync modified unexpected files."
  echo "ERROR: API sync modified unexpected files:" >&2
  printf '  %s\n' "${unexpected_files[@]}" >&2
  exit 1
fi

echo "API sync completed for backend commit ${backend_sha}."

if (( ${#changed_files[@]} == 0 )); then
  echo "No generated changes were required."
else
  echo "Changed files:"
  printf '  %s\n' "${changed_files[@]}"
fi
