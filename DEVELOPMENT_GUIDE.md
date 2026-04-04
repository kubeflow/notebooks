# Development Guide - Kubeflow Notebooks v2

Thanks for your interest in developing Kubeflow Notebooks v2! 

This document provides instructions to help you set up your development environment and get started with contributing to the project.

Please refer to the [`CONTRIBUTING.md`](CONTRIBUTING.md) for general guidelines on contributing to the project.

## Project Structure

Kubeflow Notebooks v2 is organized into several key components:

- [`workspaces/controller`](workspaces/controller): A Kubernetes controller and webook written in Go.
- [`workspaces/backend`](workspaces/backend): A backend API server written in Go _(note: also uses controller-runtime)_
- [`workspaces/frontend`](workspaces/frontend): A React-based frontend application.

## Development Workflow

### STEP 1 - Find areas to contribute

- Check the [issue tracker](https://github.com/kubeflow/notebooks/issues?q=is%3Aissue%20state%3Aopen%20label%3Aarea%2Fv2) for open issues
   - __NOTE:__ please make a comment if you intend to work on an issue to avoid duplication of effort.
- Introduce yourself on [`#kubeflow-notebooks` channel](https://www.kubeflow.org/docs/about/community/#kubeflow-slack-channels) and share your background/interests
- Attend the [Kubeflow Notebooks WG Calls](https://www.kubeflow.org/docs/about/community/#kubeflow-community-meetings) and ask for guidance

### STEP 2 - Make code changes

- Keep changes focused and small
- This guide covers two common approaches to set up your development environment:
   - [Developing with Tilt (Recommended)](#developing-with-tilt-recommended)
   - [Developing Locally](#developing-locally)
- Ensure you add appropriate tests (unit and e2e) for new features or bug fixes
- You may want to use interactive tools like [`k9s`](https://k9scli.io/) to help inspect your Kubernetes cluster during development

### STEP 3 - Run tests and linting

- Overall e2e Tests:
   - __TBA:__ instructions for running e2e tests will be added here once available.
- Controller:
   - Unit Tests: `make test`
   - Integration Tests: `make test-e2e`
   - Linting: `make lint`
- Backend:
   - Unit Tests: `make test`
   - Linting: `make lint`
- Frontend:
   - Unit Tests + Linting: `npm run test`

### STEP 4 - Submit a pull request

- Follow the [contributing guidelines](CONTRIBUTING.md)
- Remember to raise your PR against the `notebooks-v2` branch
- Ensure your PR includes:
  - A clear description of the changes
  - Relevant issue references
  - Tests for new features or bug fixes
  - Passing tests and linting checks
- Git Tips:
   - If you are brand new to git, see GitHub's [Git Guide](https://github.com/git-guides)
   - For more advanced git usage, see the [Git Book](https://git-scm.com/book/en/v2)
   - Unless you are confident it's not appropriate, please [__SQUASH__ your commits](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History) to a __single commit__ before requesting a PR review.
      - `git rebase -i HEAD~n` where `n` is the number of commits to squash.
      - Mark all but the first commit as `squash` or `s`.
      - Edit the commit message as needed.

## Developing with Tilt (recommended)

[Tilt](https://github.com/tilt-dev/tilt) makes it much easier to develop Kubernetes controllers (especially with webhooks) locally by providing a live-reload development environment.

### Tilt - Prerequisites

Before using Tilt, ensure you have the following installed:

- [Tilt](https://docs.tilt.dev/install.html) - v0.33.0 or later
- [Docker](https://docs.docker.com/get-docker/) - for building and running containers
- [Kubernetes cluster](https://kubernetes.io/docs/setup/) - a local cluster (e.g., [Kind](https://kind.sigs.k8s.io/))
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - configured to connect to your cluster

### Tilt - Quick Start

First, verify that you have the required tools installed and check their versions:

```bash
tilt version
docker --version
kubectl version --client
```

You can now start developing with Tilt by following these steps:

```bash
# (from the root of the repository)
cd developing
make tilt-up
```

What this does:

- Set up the Kind cluster (if it doesn't exist)
- Install cert-manager
- Install Istio service mesh and configure the ingress gateway
- Open the Tilt UI in your browser (usually http://localhost:10350)
- Build and deploy the controller, backend, and frontend (if enabled) to your Kubernetes cluster
- Set up port forwarding through the Istio ingress gateway for production-like routing
- Enable live updates when you make code changes

> [!IMPORTANT]
> 
> Always use `make tilt-up` instead of running `tilt up` directly. 
> 
> The Makefile ensures:
> - The Kind cluster exists and is properly configured
> - The Kubernetes context is switched to `kind-tilt`
> - Cert-manager is installed (required for webhooks)
> - Istio is installed and the ingress gateway is ready
> - All prerequisites are met before Tilt starts

> [!TIP]
>
> To run Tilt without the frontend (useful for backend/controller-only development):
>
> ```bash
> ENABLE_FRONTEND=false make tilt-up
> ```

Wait until all resources show green/healthy status. 
The frontend may take a couple of minutes on first start as webpack compiles the bundle.

Access the components through the Istio ingress gateway:

- Frontend UI: `https://localhost:8443/workspaces/` (if enabled)
- Backend API: [Swagger UI](https://localhost:8443/workspaces/api/v1/swagger/index.html)
- Controller health: `http://localhost:8080/healthz` (bypasses Istio)

> [!NOTE]
>
> The Istio ingress gateway uses a self-signed TLS certificate.
> Your browser will show a certificate warning on first access — you can safely accept it for local development.

> [!NOTE]
>
> The frontend uses webpack's file watching for live updates, but hot module replacement (HMR) over WebSocket is not available through the Istio gateway.
> After making frontend changes, manually refresh your browser to see the updates.

You can now make changes to the codebase, and Tilt will automatically rebuild and redeploy the affected components.

### Tilt - Clean Up

When you are done developing with Tilt, you can stop it and clean up the resources.

```bash
# In the terminal where Tilt is running, press Ctrl+C

# or in another terminal
# (from the root of the repository)
cd developing
make tilt-down
```

What this does:

- Stop all Tilt-managed resources
- Clean up deployments (but not the namespace)

If you want to completely remove the Kind cluster, you can do so with:

```bash
kind delete cluster --name tilt
```

## Tilt - Troubleshooting

It tilt fails to start, check the logs in the Tilt UI for specific error messages.

Alternatively, you can try building the components manually to identify issues:

```bash
# test controller build
# (from the root of the repository)
cd workspaces/controller
make build

# test backend build
# (from the root of the repository)
cd workspaces/backend
make build

# test frontend build
# (from the root of the repository)
cd workspaces/frontend
npm ci
npm run build:prod
```

> [!TIP]
>
> If you see the following error while `Tilt` is trying to build an image:
> 
> ```text
> Build Failed: failed to dial gRPC: unable to upgrade to h2c, received 404
> ```
> 
> Try disabling Docker BuildKit support in the terminal where you are running `make tilt-up`:
> ```bash
> export DOCKER_BUILDKIT=0
> ```

> [!TIP]
> 
> If you encounter other strange issues.
> 
> Try deleting the Kind cluster and starting fresh:
> 
> ```bash
> kind delete cluster --name tilt
> ```

## Developing Locally

If you prefer to develop without Tilt, you can set up your environment to build and run the Kubeflow Notebooks v2 components locally.

> [!WARNING]
> 
> When developing locally, it can be challenging to configure the webhooks correctly as they will be running on your local machine rather than inside the cluster.
> As webhooks are critical to the behavior of Kubeflow Notebooks v2, make sure you are aware of this limitation.

### Local - Prerequisites

Before developing locally, ensure you have the following installed:

- [Go](https://golang.org/doc/install) - v1.21.0 or later (for controller and backend)
- [Node.js](https://nodejs.org/) - v20.0.0 or later (for frontend)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - configured to connect to your cluster
- A Kubernetes cluster (e.g., [Kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/))

### Local - Controller

The controller is a Kubernetes operator that manages Workspace resources.

```bash
# Navigate to the controller directory
cd workspaces/controller

# View all available make targets
make help

# Build the controller binary (outputs to bin/manager)
make build

# Install CRDs into your cluster
make install

# Run the controller locally against your cluster (see "Working with Webhooks" section)
make run

# Run unit tests
make test

# Run integration tests (requires Kind cluster)
make test-e2e

# Run linter
make lint
```

> [!NOTE]
>
> When running locally, webhooks require additional setup. See [Working with Webhooks](#local---working-with-webhooks) for options.

### Local - Backend

The backend is a REST API server that provides endpoints for the frontend.

```bash
# Navigate to the backend directory
cd workspaces/backend

# View all available make targets
make help

# Build the backend binary (outputs to bin/backend)
make build

# Run the backend locally (default port: 4000)
make run

# Run on a custom port
PORT=8080 make run

# Run unit tests
make test

# Regenerate Swagger/OpenAPI documentation
make swag

# Run linter
make lint
```

> [!TIP]
>
> Access the Swagger UI at `http://localhost:4000/api/v1/swagger/` when running locally.

### Local - Frontend

The frontend is a React-based web application.

```bash
# Navigate to the frontend directory
cd workspaces/frontend

# Install dependencies
npm ci

# Start development server with hot reload
npm run start:dev

# Build for production (outputs to dist/)
npm run build:prod

# Run tests (unit tests + linting)
npm run test

# Run linter with auto-fix
npm run test:fix

# Format code with prettier
npm run prettier
```

> [!TIP]
>
> The development server runs at `http://localhost:9000` by default.

> [!IMPORTANT]
>
> The frontend requires a Kubernetes namespace to exist and proper environment configuration. Check `.env.development`:
> ```bash
> APP_ENV=development
> DEPLOYMENT_MODE=standalone
> MOCK_API_ENABLED=false              # Set to false to use real backend
> MANDATORY_NAMESPACE=workspace-test-1  # This namespace must exist in your cluster
> URL_PREFIX=                        # Must be empty to match local backend API path
> ```
> Create the namespace if it doesn't exist:
> ```bash
> kubectl create ns workspace-test-1
> ```

### Local - Working with Webhooks

Webhooks are challenging to develop locally because they require the Kubernetes API server to reach your local machine. There are several options:

#### Option 1: Disable Webhooks (Simplest)

For controller logic that doesn't involve webhooks, you can disable them entirely:

```bash
cd workspaces/controller
ENABLE_WEBHOOKS=false make run
```

This starts the controller without the webhook server. Note that resource validation won't run.

#### Option 2: Self-Signed Certificates (Full Webhook Support)

To run webhooks locally with a Kind cluster, run this single setup script from the repository root:

```bash
# Run from the repository root (not inside workspaces/controller)
# This script sets up certificates and webhook configuration for local development

# Step 1: Get host IP and generate certificate with IP SANs
HOST_IP=$(hostname -I | awk '{print $1}')
echo "Using host IP: $HOST_IP"

mkdir -p /tmp/k8s-webhook-server/serving-certs
openssl req -x509 -newkey rsa:4096 \
  -keyout /tmp/k8s-webhook-server/serving-certs/tls.key \
  -out /tmp/k8s-webhook-server/serving-certs/tls.crt \
  -days 365 -nodes -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$HOST_IP" 2>/dev/null

# Step 2: Generate and apply webhook configuration
CA_BUNDLE=$(cat /tmp/k8s-webhook-server/serving-certs/tls.crt | base64 -w0)

cat > /tmp/local-webhook.yaml << EOF
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: workspaces-local-validating-webhook
webhooks:
- admissionReviewVersions: ["v1"]
  clientConfig:
    url: https://$HOST_IP:9443/validate-kubeflow-org-v1beta1-workspace
    caBundle: $CA_BUNDLE
  failurePolicy: Fail
  name: vworkspace.kb.io
  rules:
  - apiGroups: ["kubeflow.org"]
    apiVersions: ["v1beta1"]
    operations: ["CREATE", "UPDATE"]
    resources: ["workspaces"]
  sideEffects: None
- admissionReviewVersions: ["v1"]
  clientConfig:
    url: https://$HOST_IP:9443/validate-kubeflow-org-v1beta1-workspacekind
    caBundle: $CA_BUNDLE
  failurePolicy: Fail
  name: vworkspacekind.kb.io
  rules:
  - apiGroups: ["kubeflow.org"]
    apiVersions: ["v1beta1"]
    operations: ["CREATE", "UPDATE", "DELETE"]
    resources: ["workspacekinds"]
  sideEffects: None
EOF

# Step 3: Install CRDs and apply webhook config
(cd workspaces/controller && make install)
kubectl apply -f /tmp/local-webhook.yaml

echo "Setup complete! Now run: cd workspaces/controller && make run"
```

After running the setup script, start the controller:

```bash
cd workspaces/controller
make run
```

Test the webhook by applying a sample resource:

```bash
kubectl apply -f manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml
```

Verify the resource was created (webhook validation passed):

```bash
kubectl get workspacekinds
```

If successful, you should see output like:
```
NAME         WORKSPACES   DEPRECATED   HIDDEN
jupyterlab   0            false        false
```

> [!TIP]
>
> To clean up the local webhook configuration:
> ```bash
> kubectl delete validatingwebhookconfiguration workspaces-local-validating-webhook
> ```

> [!TIP]
>
> If you see "address already in use" errors, kill the existing controller process:
> ```bash
> # Kill the process using port 8081 (or 8080/9443)
> kill -9 $(lsof -t -i:8081) 2>/dev/null
> ss -tlnp | grep -E "8080|8081|9443" || echo "Ports are free"
> ```

#### Option 3: Use Tilt (Recommended for Regular Development)

Tilt handles webhook configuration automatically by deploying the controller inside the cluster with cert-manager. See [Developing with Tilt](#developing-with-tilt-recommended).

### Local - Common Workflows

**Iterating on controller logic:**
```bash
cd workspaces/controller
make install  # Install/update CRDs
make run      # Run controller (Ctrl+C to stop and restart)
```

**Testing API changes:**
```bash
cd workspaces/backend
make swag     # Regenerate OpenAPI specs after API changes
make run      # Start the backend server
```

**Frontend development with hot reload:**
```bash
cd workspaces/frontend
npm run start:dev  # Changes auto-reload in browser
```

We welcome contributions to improve the local development experience, please open an issue or PR!