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

### Install Kind (Optional)

**Note**: Tilt will automatically create a Kind cluster named `tilt` if it doesn't exist. However, you still need to have `kind` installed.

```bash
# macOS
brew install kind

# Or follow instructions at: https://kind.sigs.k8s.io/docs/user/quick-start/#installation
```

**Alternative**: If you prefer to use a different Kubernetes cluster (Docker Desktop, Minikube, etc.), you can skip Kind installation. Just ensure your cluster is running and `kubectl` is configured to use it. Tilt will detect and use your current `kubectl` context.

## Quick Start

1. **Navigate to the developing directory**:
   ```bash
   cd workspaces/developing
   ```

2. **Start Tilt**:
   ```bash
   tilt up
   ```

   This will:
   - Open the Tilt UI in your browser (usually http://localhost:10350)
   - Build the controller and backend Docker images
   - Deploy them to your Kubernetes cluster
   - Run the frontend locally with webpack dev server (if enabled)
   - Set up port forwards for easy access
   - Enable live updates when you make code changes

3. **Monitor the Build**:

   Watch the Tilt UI in your browser. You should see:

   1. **Setup Resources** (one-time setup):
      - `setup-kind` - Creating/verifying Kind cluster (if using Kind)
      - `setup-cert-manager` - Installing cert-manager (required for webhooks)
      - `install-crds` - Installing CRDs

   2. **Local Resources**:
      - `controller-generate` - Generating manifests and code
      - `workspaces-frontend` - Running webpack dev server (if enabled)

   3. **Docker Resources** (building images):
      - `workspaces-controller`
      - `workspaces-backend`

   4. **Kubernetes Resources** (deploying):
      - Deployments, Services, etc.

   Wait until all resources show green/healthy status.

5. **Access the componenets**:
   - Controller health: `http://localhost:8081/healthz`
   - Backend API: [Swagger UI](http://localhost:4000/api/v1/swagger/)
   - Frontend UI: `http://localhost:9000` (if enabled)

6. **Stop Tilt**:
   ```bash
   # In the terminal where Tilt is running, press Ctrl+C
   # Or in another terminal:
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

### Skipping Frontend

To run Tilt without the frontend (useful for backend/controller-only development):

```bash
ENABLE_FRONTEND=false tilt up
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

Ensure:
- `kubectl` is configured correctly (`kubectl cluster-info`)
- Your cluster is running and accessible
- You have permissions to create resources in the `kubeflow-workspaces` namespace

```bash
# Verify cluster is accessible
kubectl cluster-info

# Check current context
kubectl config current-context

# List available contexts
kubectl config get-contexts
```

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
   - Always run `tilt down` when done
   - Optionally: `kubectl delete namespace kubeflow-workspaces`
