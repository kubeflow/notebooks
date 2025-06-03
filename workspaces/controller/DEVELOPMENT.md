# Development Guide

## Table of Contents

- [Development Guide](#development-guide)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
    - [In an existing cluster](#in-an-existing-cluster)
    - [Using kind](#using-kind)
  - [Teardown](#teardown)
  - [Pull Request Checklist](#pull-request-checklist)
    - [Best Practices](#best-practices)
  - [Troubleshooting](#troubleshooting)
    - ["Build Failed: failed to dial gRPC: unable to upgrade to h2c, received 404"](#build-failed-failed-to-dial-grpc-unable-to-upgrade-to-h2c-received-404)

## Introduction

This guide will help you set up a development environment for the Kubeflow Notebooks project.

## Prerequisites

- Go >= 1.22
- Kubectl >= 1.22
- A Kubernetes cluster (e.g. [kind](https://kind.sigs.k8s.io/#installation-and-usage))
- Cert-manager installed in the cluster, see [cert-manager installation guide](https://cert-manager.io/docs/installation/#default-static-install)

## Getting Started

This project uses [Tilt](https://tilt.dev/) to manage the development environment. Tilt will watch for changes in the project and automatically rebuild the Docker image and redeploy the application in the **current Kubernetes context**.

### Cluster Selection

Make sure you have a Kubernetes cluster running and `kubectl` is configured to use it.
    * `kubectl config current-context` will report which context Tilt will interact with

💡 For development purposes, you may find using `kind` to be beneficial.  You can create your own local cluster with the following command:
- `kind create cluster`
    - This command will also change the `current-context` of `kubectl` to the `kind` cluster that is created

### Running Tilt

1. Run the following command to start Tilt:

```bash
make -C devenv tilt-up
```

ℹ️ Please make sure you are in the `workspaces/controller` directory when executing the command.

2. Hit `space` to open the Tilt dashboard in your browser and here you can see the logs and status of every resource deployed.

## Teardown

To stop Tilt and remove all resources created by it, run:

```bash
make -C devenv tilt-down
```

ℹ️ Please make sure you are in the `workspaces/controller` directory when executing the command.

## Pull Request Checklist

Before raising a PR, ensure you run the following checks to maintain code quality and reliability:

1. **Linting**
   ```bash
   make lint
   ```
   - This runs static code analysis to ensure code style consistency
   - Fix any linting errors before proceeding

2. **Unit Tests**
   ```bash
   make test
   ```
   - Runs all unit tests in the project
   - Ensure all tests pass before submitting changes
   - Consider adding new tests for any new functionality

3. **End-to-End Tests**
   ```bash
   make test-e2e
   ```
   - Validates the complete workflow of the application
   - Requires a running Kubernetes cluster

### Best Practices

- Run tests locally before pushing changes
- Write meaningful commit messages
- Keep PRs focused and small
- Update documentation if you change functionality
- Consider adding new tests for new features
- Run all checks in sequence before final submission

## Troubleshooting

### "Build Failed: failed to dial gRPC: unable to upgrade to h2c, received 404"

If you see the following error message when tilt builds the image, try setting `DOCKER_BUILDKIT=0`:

```bash
DOCKER_BUILDKIT=0 make -C devenv tilt-up
```
