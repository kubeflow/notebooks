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

| URL Pattern                                          | Handler              | Action                        |
|------------------------------------------------------|----------------------|-------------------------------|
| GET /v1/healthcheck                                  | HealthcheckHandler   | Show application information. |
| GET /v1/spawner/{namespace}/workspaces               | GetWorkspacesHandler | Get all Workspaces            |
| POST /v1/spawner/{namespace}/workspaces              | TBD                  | Create a Workspace            |
| GET /v1/spawner/{namespace}/workspaces/{name}        | TBD                  | Get a Workspace entity        |
| PATCH /v1/spawner/{namespace}/workspaces/{name}      | TBD                  | Patch a Workspace entity      |
| PUT /v1/spawner/{namespace}/workspaces/{name}        | TBD                  | Update a Workspace entity     |
| DELETE /v1/spawner/{namespace}/workspaces/{name}     | TBD                  | Delete a Workspace entity     |
| GET /v1/spawner/{namespace}/workspacekinds           | TDB                  | Get all WorkspaceKind         |
| POST /v1/spawner/{namespace}/workspacekinds          | TDB                  | Create a WorkspaceKind        |
| GET /v1/spawner/{namespace}/workspacekinds/{name}    | TBD                  | Get a WorkspaceKind entity    |
| PATCH /v1/spawner/{namespace}/workspacekinds/{name}  | TBD                  | Patch a WorkspaceKind entity  |
| PUT /v1/spawner/{namespace}/workspacekinds/{name}    | TBD                  | Update a WorkspaceKind entity |
| DELETE /v1/spawner/{namespace}/workspacekinds/{name} | TBD                  | Delete a WorkspaceKind entity |

### Sample local calls
```
# GET /v1/healthcheck
curl -i localhost:4000/api/v1/healthcheck/
```
``````
# GET /v1/spawner/{namespace}/workspace
curl -i localhost:4000/api/v1/spawner/{namespace}/workspaces
```
