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

| URL Pattern                                               | Handler                   | Action                                  |
|-----------------------------------------------------------|---------------------------|-----------------------------------------|
| GET /api/v1/healthcheck                                   | healthcheck_handler       | Show application information            |
| GET /api/v1/namespaces                                    | namespaces_handler        | Get all Namespaces                      |
| GET /api/v1/swagger/                                      | swagger_handler           | Swagger API documentation               |
| GET /api/v1/workspaces                                    | workspaces_handler        | Get all Workspaces                      |
| GET /api/v1/workspaces/{namespace}                        | workspaces_handler        | Get all Workspaces from a namespace     |
| POST /api/v1/workspaces/{namespace}                       | workspaces_handler        | Create a Workspace in a given namespace |
| GET /api/v1/workspaces/{namespace}/{name}                 | workspaces_handler        | Get a Workspace entity                  |
| PATCH /api/v1/workspaces/{namespace}/{name}               | TBD                       | Patch a Workspace entity                |
| PUT /api/v1/workspaces/{namespace}/{name}                 | TBD                       | Update a Workspace entity               |
| DELETE /api/v1/workspaces/{namespace}/{name}              | workspaces_handler        | Delete a Workspace entity               |
| POST /api/v1/workspaces/{namespace}/{name}/actions/pause  | workspace_actions_handler | Set paused state of a workspace         |
| GET /api/v1/workspacekinds                                | workspacekinds_handler    | Get all WorkspaceKind                   |
| POST /api/v1/workspacekinds                               | TBD                       | Create a WorkspaceKind                  |
| GET /api/v1/workspacekinds/{name}                         | workspacekinds_handler    | Get a WorkspaceKind entity              |
| PATCH /api/v1/workspacekinds/{name}                       | TBD                       | Patch a WorkspaceKind entity            |
| PUT /api/v1/workspacekinds/{name}                         | TBD                       | Update a WorkspaceKind entity           |
| DELETE /api/v1/workspacekinds/{name}                      | TBD                       | Delete a WorkspaceKind entity           |

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
