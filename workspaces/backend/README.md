# Kubeflow Workspaces Backend

The Kubeflow Workspaces Backend is the _backend for frontend_ (BFF) used by the Kubeflow Workspaces Frontend as part of [Kubeflow Notebooks 2.0](https://github.com/kubeflow/kubeflow/issues/7156).

> ⚠️ __Warning__ ⚠️
>
> The Kubeflow Workspaces Backend is a work in progress and is __NOT__ currently ready for use.
> We greatly appreciate any contributions.

# Building and Deploying

TBD

# Development

Run the following command to build the BFF:

```shell
make build
```

After building it, you can run our app with:

```shell
make run
```

If you want to use a different port:

```shell
make run PORT=8000
```

### API Documentation

> [!IMPORTANT]
>
> This API is intended to be used only by the Kubeflow Workspaces Frontend and is __NOT__ a stable public API.
> Endpoints, request and response formats may change without notice between releases.

For the full list of endpoints, see the [Swagger UI](https://editor.swagger.io?url=https://raw.githubusercontent.com/kubeflow/notebooks/notebooks-v2/workspaces/backend/openapi/swagger.json).
