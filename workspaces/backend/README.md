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
You can view the API documentation (Swagger) here:
[View API Documentation](https://editor.swagger.io?url=https://raw.githubusercontent.com/kubeflow/notebooks/notebooks-v2/workspaces/backend/openapi/swagger.json)

### Sample local calls

Healthcheck:

```shell
# GET /api/v1/healthcheck
curl -i localhost:4000/api/v1/healthcheck
```

List all Namespaces:

```shell
# GET /api/v1/namespaces
curl -i localhost:4000/api/v1/namespaces
```

List all Workspaces:

```shell
# GET /api/v1/workspaces/
curl -i localhost:4000/api/v1/workspaces
```

List all Workspaces in a Namespace:

```shell
# GET /api/v1/workspaces/{namespace}
curl -i localhost:4000/api/v1/workspaces/default
```

Create a Workspace:

```shell
# POST /api/v1/workspaces/{namespace}
curl -X POST http://localhost:4000/api/v1/workspaces/default \
    -H "Content-Type: application/json" \
    -d '{
    "data": {
        "name": "dora",
        "kind": "jupyterlab",
        "paused": false,
        "podTemplate": {
            "podMetadata": {
                "labels": {
                    "app": "dora"
                },
                "annotations": {
                    "app": "dora"
                }
            },
            "volumes": {
                "home": "workspace-home-bella",
                "data": [
                    {
                        "pvcName": "workspace-data-bella",
                        "mountPath": "/data/my-data",
                        "readOnly": false
                    }
                ]
            },
            "options": {
                "imageConfig": "jupyterlab_scipy_190",
                "podConfig": "tiny_cpu"
            }
        }
    }
}'
```

Get a Workspace:

```shell
# GET /api/v1/workspaces/{namespace}/{name}
curl -i localhost:4000/api/v1/workspaces/default/dora
```

Pause a Workspace:

```shell
# POST /api/v1/workspaces/{namespace}/{name}/actions/pause
curl -X POST localhost:4000/api/v1/workspaces/default/dora/actions/pause \
    -H "Content-Type: application/json" \
    -d '{
    "data": {
        "paused": true
    }
}'
```

Start a Workspace:

```shell
# POST /api/v1/workspaces/{namespace}/{name}/actions/pause
curl -X POST localhost:4000/api/v1/workspaces/default/dora/actions/pause \
    -H "Content-Type: application/json" \
    -d '{
    "data": {
        "paused": false
    }
}'
```

Delete a Workspace:

```shell
# DELETE /api/v1/workspaces/{namespace}/{name}
curl -X DELETE localhost:4000/api/v1/workspaces/default/dora
```

List all WorkspaceKinds:

```shell
# GET /api/v1/workspacekinds
curl -i localhost:4000/api/v1/workspacekinds
```

Get a WorkspaceKind:

```shell
# GET /api/v1/workspacekinds/{name}
curl -i localhost:4000/api/v1/workspacekinds/jupyterlab
```

Delete a WorkspaceKind:

```shell
# DELETE /api/v1/workspacekinds/{name}
curl -X DELETE localhost:4000/api/v1/workspacekinds/jupyterlab
```
