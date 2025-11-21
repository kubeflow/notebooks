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

- [Tilt](https://docs.tilt.dev/install.html) - v0.30.0 or later
- [Docker](https://docs.docker.com/get-docker/) - for building and running containers
- [Kubernetes cluster](https://kubernetes.io/docs/setup/) - a local cluster (e.g., [Kind](https://kind.sigs.k8s.io/))
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - configured to connect to your cluster
- [Go](https://golang.org/doc/install) - v1.21.0 or later (for controller and backend)
- [Node.js](https://nodejs.org/) - v20.0.0 or later (for frontend)

### Verify Prerequisites

```bash
# Check Tilt
tilt version

# Check Docker
docker --version

# Check kubectl
kubectl version --client

# Check Go (for controller/backend)
go version

# Check Node.js (for frontend, if enabled)
node --version
npm --version
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
   make tilt
   ```

   **Important**: Always use `make tilt` instead of running `tilt up` directly. The Makefile ensures:
   - The Kind cluster exists and is properly configured
   - The Kubernetes context is switched to `kind-tilt`
   - Cert-manager is installed (required for webhooks)
   - All prerequisites are met before Tilt starts

   This will:
   - Set up the Kind cluster (if it doesn't exist)
   - Install cert-manager
   - Open the Tilt UI in your browser (usually http://localhost:10350)
   - Build the controller and backend Docker images
   - Deploy them to your Kubernetes cluster
   - Run the frontend locally with webpack dev server (if enabled)
   - Set up port forwards for easy access
   - Enable live updates when you make code changes

3. **Monitor the Build**:

   Watch the Tilt UI in your browser. You should see:

   1. **Local Resources**:
      - `controller-generate` - Generating manifests and code
      - `install-crds` - Installing CRDs
      - `workspaces-frontend` - Running webpack dev server (if enabled)

   2. **Docker Resources** (building images):
      - `workspaces-controller`
      - `workspaces-backend`

   3. **Kubernetes Resources** (deploying):
      - Deployments, Services, etc.

   **Note**: The Kind cluster and cert-manager setup are handled by the Makefile before Tilt starts, so you won't see those as Tilt resources.

   Wait until all resources show green/healthy status.

5. **Access the componenets**:
   - Controller health: `http://localhost:8081/healthz`
   - Backend API: [Swagger UI](http://localhost:4000/api/v1/swagger/)
   - Frontend UI: `http://localhost:9000` (if enabled)

6. **Stop Tilt**:
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

- `make tilt` or `make` - Set up Kind cluster, install cert-manager, and start Tilt
- `make tilt-up` - Alias for `make tilt`
- `make tilt-down` - Stop Tilt
- `make setup-kind` - Set up the Kind cluster only (without starting Tilt)
- `make setup-cert-manager` - Install cert-manager only (requires Kind cluster)

### Skipping Frontend

To run Tilt without the frontend (useful for backend/controller-only development):

```bash
ENABLE_FRONTEND=false make tilt
```

### Custom Ports

Port forwards are configured in the Tiltfile. To change them, edit the `port_forwards` parameter in the `k8s_resource()` calls.

## Development Workflow

1. **Make code changes** in any of the workspace components
   - Keep changes focused and small
2. **Tilt automatically detects changes**:
   - Controller/Backend: Rebuilds Docker images and redeploys
   - Frontend: Webpack dev server hot-reloads changes automatically
3. **View logs** in the Tilt UI or via `tilt logs <resource-name>`
4. **Add tests** for any new features
5. **Run linting checks** to ensure code style consistency
5. **Ensure tests pass** before opening a PR
6. **Write meaningful commit messages** highlighting what your code contribution is doing
7. **Be responsive** to feedback on the PR

## Frontend Development

The frontend runs as a local resource using webpack dev server instead of being built into a Docker image. This provides:

1. **Fast Hot Reloading**: Changes appear instantly in the browser without rebuilding Docker images
2. **Better Developer Experience**: Full webpack dev server features (source maps, hot module replacement, etc.)
3. **Faster Iteration**: No Docker build step needed for frontend changes
4. **Proxy Configuration**: Webpack dev server proxies API requests to the backend running in Kubernetes

The frontend uses the `.env.tilt` file for configuration when running with Tilt, which sets it up for standalone mode with proper proxy settings to connect to the backend.

## Troubleshooting

### Build Failures

If builds fail, check:

```bash
# Controller build issues
cd workspaces/controller && make build

# Backend build issues
cd workspaces/backend && make build

# Frontend dev server issues (for Tilt development)
cd workspaces/frontend && npm ci && npm run start:tilt

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

**Note**: If you're running `tilt up` directly (not via `make tilt`), you may be on the wrong Kubernetes context. Always use `make tilt` to ensure the correct context is set.

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
