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

### In an existing cluster

1. Make sure you have a Kubernetes cluster running and `kubectl` is configured to use it.
2. Run the following command to start Tilt:

```bash
make -C devenv tilt-up
```

3. Hit `space` to open the Tilt dashboard in your browser and here you can see the logs and status of every resource deployed.

### Using kind

1. Create a kind cluster:

```bash
kind create cluster
```

2. Run the following command to start Tilt:

```bash
make -C devenv tilt-up
```

3. Hit `space` to open the Tilt dashboard in your browser and here you can see the logs and status of every resource deployed.

## Teardown

To stop Tilt and remove all resources created by it, run:

```bash
make -C devenv tilt-down
```

## Troubleshooting

### "Build Failed: failed to dial gRPC: unable to upgrade to h2c, received 404"

If you see the following error message when tilt builds the image, try setting `DOCKER_BUILDKIT=0`:

```bash
DOCKER_BUILDKIT=0 make -C devenv tilt-up
```
