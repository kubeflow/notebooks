#!/bin/bash
set -euo pipefail

GENERATED_DIR="./src/generated"
HASH_FILE="./scripts/swagger.version"
SWAGGER_COMMIT_HASH=$(cat "$HASH_FILE")
SWAGGER_JSON_PATH="../backend/openapi/swagger.json"
TMP_SWAGGER=".tmp-swagger.json"

if ! git cat-file -e "${SWAGGER_COMMIT_HASH}:${SWAGGER_JSON_PATH}"; then
  echo "❌ Swagger file not found at commit $SWAGGER_COMMIT_HASH"
  exit 1
fi

git show "${SWAGGER_COMMIT_HASH}:${SWAGGER_JSON_PATH}" >"$TMP_SWAGGER"

swagger-typescript-api generate \
  -p "$TMP_SWAGGER" \
  -o "$GENERATED_DIR" \
  --extract-request-body \
  --responses \
  --clean-output \
  --axios \
  --unwrap-response-data \
  --modular

rm "$TMP_SWAGGER"
