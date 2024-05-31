# Kubeflow Workspaces Backend
The Kubeflow Workspaces Backend is the _backend for frontend_ (BFF) used by the Kubeflow Workspaces UI as part of [Kubeflow Notebooks 2.0](https://github.com/kubeflow/kubeflow/issues/7156).

> ⚠️ __Warning__ ⚠️
>
> The Kubeflow Workspaces Backend is a work in progress and is __NOT__ currently ready for use.
> We greatly appreciate any contributions.

# Building and Deploying
TBD

# Development
## Getting started

### Endpoints

| URL Pattern         | Handler            | Action                        |
|---------------------|--------------------|-------------------------------|
| GET /v1/healthcheck | HealthcheckHandler | Show application information. |


### Sample local calls
```
# GET /v1/healthcheck
curl -i localhost:4000/api/v1/healthcheck/
```