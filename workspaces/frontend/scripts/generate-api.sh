#!/bin/bash
set -euo pipefail

GENERATED_DIR="./src/generated"
HASH_FILE="./scripts/swagger.version"
SWAGGER_COMMIT_HASH=$(tr -d '\r\n' < "$HASH_FILE")
SWAGGER_JSON_PATH="${SWAGGER_JSON_PATH:-../backend/openapi/swagger.json}"
TMP_SWAGGER=".tmp-swagger.json"

# Check if we should use local or container swagger file/URL
if [ "${USE_LOCAL_SWAGGER:-false}" = "true" ] || [ "${DEV_ENV:-}" = "tilt" ]; then
  echo "Using local/container swagger spec: $SWAGGER_JSON_PATH"
  if [[ "$SWAGGER_JSON_PATH" =~ ^https?:// ]]; then
    node -e "fetch('$SWAGGER_JSON_PATH').then(r => { if (!r.ok) throw new Error('status ' + r.status); return r.text(); }).then(t => process.stdout.write(t)).catch(e => { console.error(e); process.exit(1); })" > "$TMP_SWAGGER"
  else
    if [ ! -f "$SWAGGER_JSON_PATH" ]; then
      echo "❌ Local Swagger file not found at $SWAGGER_JSON_PATH"
      exit 1
    fi
    cp "$SWAGGER_JSON_PATH" "$TMP_SWAGGER"
  fi
else
  # Default git-hash-based generation for production/CI
  if ! git cat-file -e "${SWAGGER_COMMIT_HASH}:${SWAGGER_JSON_PATH}"; then
    echo "❌ Swagger file not found at commit $SWAGGER_COMMIT_HASH"
    exit 1
  fi
  git show "${SWAGGER_COMMIT_HASH}:${SWAGGER_JSON_PATH}" >"$TMP_SWAGGER"
fi

swagger-typescript-api generate \
  -p "$TMP_SWAGGER" \
  -o "$GENERATED_DIR" \
  --extract-request-body \
  --responses \
  --clean-output \
  --axios \
  --unwrap-response-data \
  --modular

SCHEMA_OUTPUT="./src/app/pages/WorkspaceKinds/Form/yamlEditor/workspaceKindUpdateSchema.json"
node ./scripts/generate-schema.js "$TMP_SWAGGER" "$SCHEMA_OUTPUT"

rm "$TMP_SWAGGER"
