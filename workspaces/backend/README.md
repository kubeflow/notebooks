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

### Endpoints

The `backend` server exposes a Swagger UI typically available at localhost:4000/api/v1/swagger/index.html.
- :warning:  If providing a `PORT` override in `make run`, please ensure to use that port when composing the URL

Running the `backend` to serve the Swagger UI is the proper means to learning about and interacting with the available APIs.

If you wish to understand which handlers service the various endpoints, you can find the mapping in the `Routes()` function in [`app.go`](./api/app.go).
