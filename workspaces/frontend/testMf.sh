#!/usr/bin/env bash
set -euo pipefail

# --- paths ---
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/workspaces/frontend"
cd "${FRONTEND_DIR}"

echo "==> Checking Makefile presence"
test -f Makefile

echo "==> Verifying required targets exist"
# List all make targets and check required ones
targets="$(make -qp 2>/dev/null | awk -F':' '/^[a-zA-Z0-9][^$#\t=]*:/{print $1}' | sort -u)"
for t in docker-build docker-push docker-buildx deploy undeploy; do
  echo "${targets}" | grep -qx "${t}" || { echo "Missing target: ${t}"; exit 1; }
done

echo "==> Checking help output includes targets"
help_out="$(make help)"
for t in docker-build docker-push docker-buildx deploy undeploy; do
  echo "${help_out}" | grep -qE "^[[:space:]]+${t}[[:space:]]" || { echo "help missing ${t}"; exit 1; }
done

# --- stub tools/bin dir ---
TMPBIN="${FRONTEND_DIR}/.testbin"
mkdir -p "${TMPBIN}"
PATH="${TMPBIN}:${PATH}"

# Stub container tool (docker/podman) -> just echo
cat > "${TMPBIN}/docker" <<'EOF'
#!/usr/bin/env bash
echo "[docker stub] $@"
exit 0
EOF
chmod +x "${TMPBIN}/docker"

# Stub kubectl and kustomize -> echo
cat > "${TMPBIN}/kubectl" <<'EOF'
#!/usr/bin/env bash
echo "[kubectl stub] $@"
cat >/dev/null  # swallow stdin
EOF
chmod +x "${TMPBIN}/kubectl"

cat > "${TMPBIN}/kustomize" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "build" ]]; then
  echo "[kustomize stub] build $2"
  # emit a fake yaml to pipe into kubectl
  cat <<YAML
apiVersion: v1
kind: ConfigMap
metadata:
  name: demo
data:
  foo: bar
YAML
else
  echo "[kustomize stub] $@"
fi
EOF
chmod +x "${TMPBIN}/kustomize"

# --- minimal Dockerfile for buildx target (it rewrites the first FROM line) ---
if [[ ! -f Dockerfile ]]; then
  echo "FROM alpine:3.19" > Dockerfile
fi

# --- minimal Kustomize dir for deploy/undeploy ---
KZ_DIR="${FRONTEND_DIR}/.kztest"
mkdir -p "${KZ_DIR}"
cat > "${KZ_DIR}/kustomization.yaml" <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources: []
images:
  - name: frontend
    newName: placeholder
EOF

echo "==> Test docker-build (stubbed)"
make docker-build IMG=test/frontend:dev CONTAINER_TOOL=docker

echo "==> Test docker-push (stubbed)"
make docker-push IMG=test/frontend:dev CONTAINER_TOOL=docker

echo "==> Test docker-buildx (stubbed)"
# buildx creates/uses/removes a builder; our docker stub will just print args
make docker-buildx IMG=test/frontend:multi CONTAINER_TOOL=docker PLATFORMS=linux/amd64,linux/arm64

echo "==> Test deploy (stubbed)"
make deploy KUSTOMIZE_DIR="${KZ_DIR}" KUSTOMIZE="${TMPBIN}/kustomize" KUBECTL="${TMPBIN}/kubectl" IMG=test/frontend:dev

echo "==> Test undeploy (stubbed)"
make undeploy KUSTOMIZE_DIR="${KZ_DIR}" KUSTOMIZE="${TMPBIN}/kustomize" KUBECTL="${TMPBIN}/kubectl" ignore-not-found=true

echo "==> All acceptance checks passed."
