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
- Open the Tilt UI in your browser (usually http://localhost:10350)
- Build and deploy the controller, backend, and frontend (if enabled) to your Kubernetes cluster
- Set up port forwards for easy access
- Enable live updates when you make code changes

> [!IMPORTANT]
> 
> Always use `make tilt-up` instead of running `tilt up` directly. 
> 
> The Makefile ensures:
> - The Kind cluster exists and is properly configured
> - The Kubernetes context is switched to `kind-tilt`
> - Cert-manager is installed (required for webhooks)
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

Access the components:

- Controller health: `http://localhost:8081/healthz`
- Backend API: [Swagger UI](http://localhost:4000/api/v1/swagger/)
- Frontend UI: `http://localhost:9000` (if enabled)

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

If you prefer to develop without Tilt, you can set up your environment to build and run the Kubeflow Notebooks v2 controller locally.

> [!WARNING]
> 
> When developing locally, it can be challenging to configure the webhooks correctly as they will be running on your local machine rather than inside the cluster.
> As webhooks are critical to the behavior of Kubeflow Notebooks v2, make sure you are aware of this limitation.

### Local - Prerequisites

Before developing locally, ensure you have the following installed:

- [Go](https://golang.org/doc/install) - v1.21.0 or later (for controller and backend)
- [Node.js](https://nodejs.org/) - v20.0.0 or later (for frontend)

### Local - Quick Start

Each component has a `Makefile` or `package.json` to help with building, testing, and running the component locally.
You should start by reviewing the these files in each component directory.

We welcome contributions to improve the local development experience, please open an issue or PR!