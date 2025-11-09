# Language & Toolchain Upgrade Plan (Component-Scoped)

## Targets
- Go: 1.24
- Python: 3.12
- Node.js: 24

## PR Strategy
- Create separate PRs per component and per language.
- Keep scope to toolchain + minimal dependency alignments required to keep CI green.
- No functional code changes in these PRs.

---

## Go → 1.24

### components/notebook-controller
- Files to update
  - `notebooks/components/notebook-controller/go.mod` → `go 1.24`
  - `notebooks/components/notebook-controller/Dockerfile`
    - `ARG GOLANG_VERSION=1.24`
    - `FROM golang:${GOLANG_VERSION}`
  - CI: `notebooks/.github/workflows/nb_controller_unit_test.yaml` → `go-version: "1.24"`
- How to test
  - `cd notebooks/components/notebook-controller && go mod tidy && go build ./...`
  - Re-run nb controller unit/integration workflows
  - `docker build -f notebooks/components/notebook-controller/Dockerfile notebooks/components`

### components/tensorboard-controller
- Files to update
  - `notebooks/components/tensorboard-controller/go.mod` → `go 1.24`
  - `notebooks/components/tensorboard-controller/Dockerfile`
    - `FROM golang:1.24`
  - CI: `notebooks/.github/workflows/tb_controller_unit_test.yaml` → `go-version: "1.24"`
- How to test
  - `cd notebooks/components/tensorboard-controller && go mod tidy && go build ./...`
  - Re-run tb controller unit/integration workflows
  - `docker build -f notebooks/components/tensorboard-controller/Dockerfile notebooks/components`

### components/pvcviewer-controller
- Files to update
  - `notebooks/components/pvcviewer-controller/go.mod` → `go 1.24`
  - `notebooks/components/pvcviewer-controller/Dockerfile`
    - `ARG GOLANG_VERSION=1.24`
  - CI: `notebooks/.github/workflows/pvcviewer_controller_unit_test.yaml` → `go-version: "1.24"`
- How to test
  - `cd notebooks/components/pvcviewer-controller && go mod tidy && go build ./...`
  - Re-run pvcviewer unit/integration workflows
  - `docker build -f notebooks/components/pvcviewer-controller/Dockerfile notebooks/components`

Notes
- If a dependency enforces a higher minimum Go, bump that dep to the nearest compatible tag or, if unavoidable, capture and propose a separate targeted follow-up.

---

## Python → 3.12

### crud-web-apps/jupyter (backend image)
- Files to update
  - `notebooks/components/crud-web-apps/jupyter/Dockerfile`
    - `FROM python:3.12-slim` (wheel + web stages)
  - CI: `notebooks/.github/workflows/jwa_backend_unittests.yaml` → `python-version: "3.12"`
  - CI: `notebooks/.github/workflows/python_lint.yaml` → `python-version: "3.12"`
- How to test
  - `docker build -f notebooks/components/crud-web-apps/jupyter/Dockerfile notebooks/components`
  - Run `jwa_backend_unittests.yaml` + `python_lint.yaml`

### crud-web-apps/tensorboards (backend image)
- Files to update
  - `notebooks/components/crud-web-apps/tensorboards/Dockerfile`
    - `FROM python:3.12-slim` (wheel + web stages)
- How to test
  - `docker build -f notebooks/components/crud-web-apps/tensorboards/Dockerfile notebooks/components`

### crud-web-apps/volumes (backend image)
- Files to update
  - `notebooks/components/crud-web-apps/volumes/Dockerfile`
    - `FROM python:3.12-slim` (wheel + web stages)
- How to test
  - `docker build -f notebooks/components/crud-web-apps/volumes/Dockerfile notebooks/components`

### example-notebook-servers/jupyter
- Files to update
  - `notebooks/components/example-notebook-servers/jupyter/Dockerfile`
    - `ARG PYTHON_VERSION=3.12.x` (e.g., `3.12.6`)
- How to test
  - `cd notebooks/components/example-notebook-servers/jupyter && docker build --build-arg PYTHON_VERSION=3.12.6 .`

### example-notebook-servers/codeserver-python
- Files to update
  - `notebooks/components/example-notebook-servers/codeserver-python/Dockerfile`
    - `ARG PYTHON_VERSION=3.12.x` (e.g., `3.12.6`)
- How to test
  - `cd notebooks/components/example-notebook-servers/codeserver-python && docker build --build-arg PYTHON_VERSION=3.12.6 .`

### example-notebook-servers/rstudio
- Files to update
  - `notebooks/components/example-notebook-servers/rstudio/Dockerfile`
    - `ARG PYTHON_VERSION=3.12.x` (e.g., `3.12.6`)
- How to test
  - `cd notebooks/components/example-notebook-servers/rstudio && docker build --build-arg PYTHON_VERSION=3.12.6 .`

### example-notebook-servers/jupyter-pytorch-gaudi
- Files to update
  - `notebooks/components/example-notebook-servers/jupyter-pytorch-gaudi/Dockerfile`
    - `ARG PYTHON_VERSION=3.12.x` (e.g., `3.12.6`)
- How to test
  - `cd notebooks/components/example-notebook-servers/jupyter-pytorch-gaudi && docker build --build-arg PYTHON_VERSION=3.12.6 .`

Notes
- If wheels fail on 3.12, bump only the failing packages (e.g., Flask/Werkzeug) in the same PR if no source changes are needed. Otherwise, record for a follow-up dependency PR.

---

## Node.js → 24

### crud-web-apps/common/frontend/kubeflow-common-lib
- Files to update
  - Builds are invoked via app Dockerfiles, but validate library builds locally.
- How to test
  - `cd notebooks/components/crud-web-apps/common/frontend/kubeflow-common-lib && npm ci && npm run build`

### crud-web-apps/jupyter (frontend)
- Files to update
  - `notebooks/components/crud-web-apps/jupyter/Dockerfile`
    - `FROM node:24-bookworm` (kubeflow-lib + frontend stages)
  - CI: `notebooks/.github/workflows/jwa_frontend_tests.yaml` → `node-version: 24`
  - CI: `notebooks/.github/workflows/common_frontend_tests.yaml` → `node-version: 24`
- How to test
  - `cd notebooks/components/crud-web-apps/jupyter/frontend && npm ci && npm run build`
  - Re-run JWA/common frontend workflows

### crud-web-apps/tensorboards (frontend)
- Files to update
  - `notebooks/components/crud-web-apps/tensorboards/Dockerfile`
    - `FROM node:24-bookworm` (kubeflow-lib + frontend stages)
  - CI: `notebooks/.github/workflows/twa_frontend_tests.yaml` → `node-version: 24`
- How to test
  - `cd notebooks/components/crud-web-apps/tensorboards/frontend && npm ci && npm run build`
  - Re-run TWA frontend workflows

### crud-web-apps/volumes (frontend)
- Files to update
  - `notebooks/components/crud-web-apps/volumes/Dockerfile`
    - `FROM node:24-bookworm` (kubeflow-lib + frontend stages)
  - CI: `notebooks/.github/workflows/vwa_frontend_tests.yaml` → `node-version: 24`
- How to test
  - `cd notebooks/components/crud-web-apps/volumes/frontend && npm ci && npm run build`
  - Re-run VWA frontend workflows

### example-notebook-servers/jupyter (node in base)
- Files to update
  - `notebooks/components/example-notebook-servers/jupyter/Dockerfile`
    - `ARG NODE_MAJOR_VERSION=24`
- How to test
  - `cd notebooks/components/example-notebook-servers/jupyter && docker build --build-arg NODE_MAJOR_VERSION=24 .`

Notes
- If Node 24 breaks the Angular/Webpack toolchain, bump minimal build-time deps (webpack, @babel/helpers) in the same PR if no source changes are needed; else follow-up PR.

---

## Validation & Backout

- Validation (per PR)
  - All scoped modules/apps build.
  - CI workflows for the component pass.
  - No functional code changes included.

- Backout
  - Revert the Dockerfile base tags, CI tool versions, and `go.mod` directives for the affected component only.

## Success Criteria
- Each component builds on Go 1.24 / Python 3.12 / Node 24.
- All relevant CI workflows green after the bump.
- Minimal disruption to dependency remediation work that follows.

## Task Dependencies

- Task 1: Go 1.24 — notebook-controller
  - Dependencies: None (independent Go module).
- Task 2: Go 1.24 — tensorboard-controller
  - Dependencies: None (independent Go module).
- Task 3: Go 1.24 — pvcviewer-controller
  - Dependencies: None (independent Go module).

- Task 4: Python 3.12 — crud-web-apps/jupyter (backend)
  - Dependencies: Soft upstream for Tasks 5–6.
  - Why: Jupyter’s Dockerfile builds the shared `common/backend` wheel. Validating it on 3.12 first avoids duplicating the same wheel fixes in other backends.

- Task 5: Python 3.12 — crud-web-apps/tensorboards (backend)
  - Dependencies: Soft depends on Task 4 outcome (wheel compiles on 3.12 and any pin bumps).
  - Why: Reuses `common/backend` wheel; apply the same pins if needed.

- Task 6: Python 3.12 — crud-web-apps/volumes (backend)
  - Dependencies: Soft depends on Task 4 outcome (same reason as Task 5).

- Task 7: Python 3.12 — example-notebook-servers/
  - Dependencies: None (separate image flow, no CRUD wheel).
  - Also include in the same PR (same change type, independent):
    - `example-notebook-servers/jupiter` (ARG PYTHON_VERSION → 3.12.x)
    - `example-notebook-servers/ codeserver-python` (ARG PYTHON_VERSION → 3.12.x)
    - `example-notebook-servers/rstudio` (ARG PYTHON_VERSION → 3.12.x)
    - `example-notebook-servers/jupyter-pytorch-gaudi` (ARG PYTHON_VERSION → 3.12.x)

- Task 8: Node 24 — kubeflow-common-lib
  - Dependencies: Soft upstream for Tasks 9–11.
  - Why: App frontends import the lib; their Dockerfiles copy `dist/kubeflow` from the lib build stage. Proving the lib builds on Node 24 reduces repeated failures.

- Task 9: Node 24 — crud-web-apps/jupyter/frontend
  - Dependencies: Soft depends on Task 8 (lib builds on Node 24).
  - Why: Uses the built lib artifacts; update CI node-version in this PR.

- Task 10: Node 24 — crud-web-apps/tensorboards/frontend
  - Dependencies: Soft depends on Task 8 (same reason as Task 9).

- Task 11: Node 24 — crud-web-apps/volumes/frontend
  - Dependencies: Soft depends on Task 8 (same reason as Task 9).

- Task 12: Node 24 — example-notebook-servers/jupyter
  - Dependencies: None (separate image ARG; not tied to CRUD or lib).