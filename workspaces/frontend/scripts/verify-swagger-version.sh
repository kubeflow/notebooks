#!/usr/bin/env bash

set -euo pipefail

if (( $# < 1 || $# > 2 )); then
    echo "Usage: $0 <target-ref> [swagger-sha]" >&2
    exit 2
fi

target_ref="$1"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
version_file="${script_dir}/swagger.version"

if (( $# == 2 )); then
    swagger_sha="$2"
else
    swagger_sha="$(tr -d '[:space:]' < "${version_file}")"
fi

echo "Swagger revision: ${swagger_sha}"
echo "Target ref: ${target_ref}"

if [[ ! "${swagger_sha}" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "ERROR: swagger.version must contain a full 40-character Git SHA." >&2
    exit 1
fi

if ! git rev-parse --verify --quiet "${target_ref}^{commit}" >/dev/null; then
    echo "ERROR: target ref '${target_ref}' does not resolve to a commit." >&2
    exit 1
fi

if ! git cat-file -e "${swagger_sha}^{commit}" 2>/dev/null; then
    echo "ERROR: Swagger revision '${swagger_sha}' does not exist in the local Git object database." >&2
    exit 1
fi

if git merge-base --is-ancestor "${swagger_sha}" "${target_ref}"; then
    echo "Swagger revision is in the history of ${target_ref}."
    exit 0
else
    status=$?

    if [[ "${status}" -eq 1 ]]; then
        echo "ERROR: Swagger revision '${swagger_sha}' is not in the history of '${target_ref}'." >&2
        exit 1
    fi

    echo "ERROR: Git could not determine ancestry (exit ${status})." >&2
    exit "${status}"
fi
