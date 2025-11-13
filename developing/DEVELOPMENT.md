# Development Guide with Tilt

This directory contains the Tilt configuration for local development of the Kubeflow Notebooks workspace components (controller, backend, and frontend).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Frontend Development](#frontend-development)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Prerequisites

Before using Tilt, ensure you have the following installed:

### Required

- [Tilt](https://docs.tilt.dev/install.html) - v0.33.0 or later
- [Docker](https://docs.docker.com/get-docker/) - for building and running containers
- [Kubernetes cluster](https://kubernetes.io/docs/setup/) - a local cluster (e.g., [Kind](https://kind.sigs.k8s.io/))
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - configured to connect to your cluster

### Optional (for local testing and debugging)

All components build inside Docker containers, so Go and Node.js are **not required** to run Tilt. However, they are useful for:
- Running tests locally (`make test`, `npm run test`)
- Running linters locally (`make lint`, `npm run test:lint`)
- IDE support (type checking, autocompletion)

If you need these capabilities:
- [Go](https://golang.org/doc/install) - v1.21.0 or later (for controller and backend)
- [Node.js](https://nodejs.org/) - v20.0.0 or later (for frontend)

### Verify Prerequisites

```bash
# Required
tilt version
docker --version
kubectl version --client

# Optional (only if installed)
go version
node --version
```

### Install Kind

**Note**: The Makefile will automatically create a Kind cluster named `tilt` if it doesn't exist. However, you still need to have `kind` installed.

```bash
# macOS
brew install kind

# Or follow instructions at: https://kind.sigs.k8s.io/docs/user/quick-start/#installation
```


### Using Kind Provider (Optional)

You can choose to set the `KIND_EXPERIMENTAL_PROVIDER` environment variable in your shell session:

```bash
export KIND_EXPERIMENTAL_PROVIDER=podman
```

The Makefile will honor this environment variable when creating the Kind cluster.

## Quick Start

1. **Navigate to the developing directory**:
   ```bash
   cd developing
   ```

2. **Start Tilt using the Makefile**:
   ```bash
   make tilt-up
   ```

   **Important**: Always use `make tilt-up` instead of running `tilt up` directly. The Makefile ensures:
   - The Kind cluster exists and is properly configured
   - The Kubernetes context is switched to `kind-tilt`
   - Cert-manager is installed (required for webhooks)
   - All prerequisites are met before Tilt starts

   This will:
   - Set up the Kind cluster (if it doesn't exist)
   - Install cert-manager
   - Open the Tilt UI in your browser (usually http://localhost:10350)
   - Build and deploy the controller, backend, and frontend (if enabled) to your Kubernetes cluster
   - Set up port forwards for easy access
   - Enable live updates when you make code changes

3. **Monitor the Build**:

   Watch the Tilt UI in your browser. You should see:

   1. **Kubernetes Resources** (building and deploying):
      - `workspaces-controller` - Controller deployment with CRDs
      - `workspaces-backend` - Backend API server
      - `workspaces-frontend` - Frontend with webpack dev server (if enabled)

   **Note**: The Kind cluster and cert-manager setup are handled by the Makefile before Tilt starts, so you won't see those as Tilt resources.

   Wait until all resources show green/healthy status. The frontend may take a couple of minutes on first start as webpack compiles the bundle.

4. **Access the components**:
   - Controller health: `http://localhost:8081/healthz`
   - Backend API: [Swagger UI](http://localhost:4000/api/v1/swagger/)
   - Frontend UI: `http://localhost:9000` (if enabled)

5. **Stop Tilt**:
   ```bash
   # In the terminal where Tilt is running, press Ctrl+C
   # Or in another terminal:
   make tilt-down
   # Or:
   tilt down
   ```

   This will:
   - Stop all Tilt-managed resources
   - Clean up deployments (but not the namespace)

### Optional: Clean up namespace

```bash
kubectl delete namespace kubeflow-workspaces
```

### Optional: Delete Kind cluster

```bash
kind delete cluster --name tilt
```

## Configuration

### Makefile Targets

The Makefile provides several targets for managing your development environment:

- `make tilt-up` - Set up Kind cluster, install cert-manager, and start Tilt
- `make tilt-down` - Stop Tilt
- `make setup-kind` - Set up the Kind cluster only (without starting Tilt)
- `make setup-cert-manager` - Install cert-manager only (requires Kind cluster)

### Skipping Frontend

To run Tilt without the frontend (useful for backend/controller-only development):

```bash
ENABLE_FRONTEND=false make tilt-up
```

### Custom Ports

Port forwards are configured in the Tiltfile. To change them, edit the `port_forwards` parameter in the `k8s_resource()` calls.

## Development Workflow

1. **Make code changes** in any of the workspace components
   - Keep changes focused and small
2. **Tilt automatically detects changes**:
   - Controller/Backend: Rebuilds Docker images and redeploys
   - Frontend: Uses live_update to sync files into the container, then webpack HMR updates the browser
3. **View logs** in the Tilt UI or via `tilt logs <resource-name>`
4. **Add tests** for any new features
5. **Run linting checks** to ensure code style consistency
6. **Ensure tests pass** before opening a PR
7. **Write meaningful commit messages** highlighting what your code contribution is doing
8. **Be responsive** to feedback on the PR

## Frontend Development

The frontend runs in a Kubernetes pod using webpack dev server with Tilt's `live_update` feature. This provides:

1. **Fast Hot Reloading**: Changes to source files are synced directly into the container without rebuilding the Docker image
2. **Hot Module Replacement**: Webpack dev server's HMR provides instant feedback on code changes
3. **Kubernetes-Native**: The frontend runs in the same environment as production (nginx serves the frontend in prod)
4. **Automatic Dependency Updates**: When `package.json` or `package-lock.json` changes, Tilt automatically runs `npm install` in the container

### How Live Update Works

When you modify files in `src/` or `config/`:
1. Tilt detects the file change
2. The changed files are synced directly into the running container
3. Webpack dev server detects the changes and triggers HMR
4. Your browser updates without a full page reload

For dependency changes (`package.json` or `package-lock.json`):
1. Tilt syncs the updated files
2. Tilt runs `npm install` inside the container
3. Webpack dev server restarts with the new dependencies

### Initial Startup

The frontend may take 2-3 minutes on first start as webpack compiles the full bundle. A startup probe is configured to allow up to 5 minutes for initial compilation. Once the initial build completes, subsequent HMR updates are nearly instant.

## Troubleshooting

### Build Failures

If builds fail, check:

```bash
# Controller build issues
cd workspaces/controller && make build

# Backend build issues
cd workspaces/backend && make build

# Frontend dev container issues (test the Tilt Dockerfile)
docker build -f developing/dockerfiles/Dockerfile.frontend.tilt workspaces/frontend

# Frontend production build issues (for testing production builds)
cd workspaces/frontend && npm ci && npm run build:prod
```

Also verify:
- All prerequisites are installed
- Makefiles can find their dependencies
- Go modules are downloaded (`go mod download` in controller/backend)
- Node modules are installed (`npm ci` in frontend)

#### BuildKit

If you see the following error while `Tilt` is trying to build an image:
```
Build Failed: failed to dial gRPC: unable to upgrade to h2c, received 404
```

Try disabling Docker BuildKit support in the terminal where you are running `tilt up`:
```bash
export DOCKER_BUILDKIT=0
```


### Kubernetes Connection Issues

The Makefile automatically handles context switching to `kind-tilt`. If you encounter issues:

1. **Verify the Kind cluster exists**:
   ```bash
   kind get clusters
   ```

2. **Check the current context**:
   ```bash
   kubectl config current-context
   # Should be: kind-tilt
   ```

3. **If context is wrong, manually switch**:
   ```bash
   kubectl config use-context kind-tilt
   ```

4. **Verify cluster is accessible**:
   ```bash
   kubectl cluster-info
   ```

5. **Ensure you have permissions** to create resources in the `kubeflow-workspaces` namespace

**Note**: If you're running `tilt up` directly (not via `make tilt-up`), you may be on the wrong Kubernetes context. Always use `make tilt-up` to ensure the correct context is set.

### Port Already in Use

If ports are already in use, you can:

1. Stop the conflicting service
2. Or modify port forwards in the Tiltfile

### CRD Installation Fails

If CRDs fail to install:

```bash
# Check if you have permissions
kubectl auth can-i create crds

# Try installing manually
cd workspaces/controller && make install
```

Also check that you have cluster-admin permissions or appropriate RBAC.

### Frontend Container Issues

If the frontend is not loading or showing errors:

1. **Check the pod logs**:
   ```bash
   kubectl logs -n kubeflow-workspaces -l app=workspaces-frontend -f
   ```

2. **Check if webpack is still compiling** (initial build can take 2-3 minutes):
   ```bash
   kubectl get pods -n kubeflow-workspaces -l app=workspaces-frontend
   # Look for the Ready status - 0/1 means still starting up
   ```

3. **Check for JavaScript/TypeScript errors** in the Tilt UI logs for the `workspaces-frontend` resource

4. **If live_update isn't working**, try triggering a full rebuild by clicking the refresh button in the Tilt UI

5. **Memory issues** - if webpack crashes with OOM errors, the container may need more memory (the Tiltfile configures 2Gi limit for development)

## Best Practices

1. **Run tests before committing**:
   ```bash
   # Controller
   cd workspaces/controller && make lint && make test

   # Backend
   cd workspaces/backend && make lint && make test

   # Frontend
   cd workspaces/frontend && npm run test
   ```

2. **Keep dependencies up to date**:
   - Go modules: `go mod tidy` in controller/backend
   - Node modules: `npm ci` in frontend

3. **Clean up resources**:
   - Always run `make tilt-down` (or `tilt down`) when done
   - Optionally: `kubectl delete namespace kubeflow-workspaces`
   - Optionally: `kind delete cluster --name tilt` to remove the Kind cluster
