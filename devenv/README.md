# Kubeflow Notebooks -- Dev Environment

## Requirements

- Go >= 1.22
- Helm >= 3.16.1

## Tilt

This project uses [Tilt](https://tilt.dev/) to manage the development environment. Tilt will watch for changes in the project and automatically rebuild the Docker image and redeploy the application in the current Kubernetes context.

See this example using a kind cluster:

```bash
kind create cluster
```

then:

```bash
make tilt-up
```

Hit `space` to open the Tilt dashboard in your browser and here you can see the logs and status of every resource deployed.


## Troubleshooting

### "Build Failed: failed to dial gRPC: unable to upgrade to h2c, received 404"

If you see the following error message when tilt builds the image, try setting `DOCKER_BUILDKIT=0`:

```bash
DOCKER_BUILDKIT=0 make tilt-up
```
