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

| URL Pattern                              | Handler              | Action                                  |
|------------------------------------------|----------------------|-----------------------------------------|
| GET /v1/healthcheck                      | HealthcheckHandler   | Show application information.           |
| GET /v1/workspaces                       | GetWorkspacesHandler | Get all Workspaces                      |
| GET /v1/workspaces/{namespace}           | GetWorkspacesHandler | Get all Workspaces from a namespace     |
| POST /v1/workspaces/{namespace}          | TBD                  | Create a Workspace in a given namespace |
| GET /v1/workspaces/{namespace}/{name}    | TBD                  | Get a Workspace entity                  |
| PATCH /v1/workspaces/{namespace}/{name}  | TBD                  | Patch a Workspace entity                |
| PUT /v1/workspaces/{namespace}/{name}    | TBD                  | Update a Workspace entity               |
| DELETE /v1/workspaces/{namespace}/{name} | TBD                  | Delete a Workspace entity               |
| GET /v1/workspacekinds                   | TBD                  | Get all WorkspaceKind                   |
| POST /v1/workspacekinds                  | TBD                  | Create a WorkspaceKind                  |
| GET /v1/workspacekinds/{name}            | TBD                  | Get a WorkspaceKind entity              |
| PATCH /v1/workspacekinds/{name}          | TBD                  | Patch a WorkspaceKind entity            |
| PUT /v1/workspacekinds/{name}            | TBD                  | Update a WorkspaceKind entity           |
| DELETE /v1/workspacekinds/{name}         | TBD                  | Delete a WorkspaceKind entity           |

### Sample local calls
```
# GET /v1/healthcheck
curl -i localhost:4000/api/v1/healthcheck
```
```
# GET /v1/workspaces/
curl -i localhost:4000/api/v1/workspaces
```
```
# GET /v1/workspaces/{namespace}
curl -i localhost:4000/api/v1/workspaces/default
```
