# Current status of Kubeflow Notebooks v2

> [!WARNING]
>
> Kubeflow Notebooks v2 is __not yet released__ and currently in an alpha stage.
> We are actively developing the first stable release and will share updates soon.
> See [`kubeflow/notebooks#85`](https://github.com/kubeflow/notebooks/issues/85) for more details.

| Feature                                   | Frontend      | Backend      | Controller   |
| ----------------------------------------- | ------------- | ------------ | ------------ |
| **Create a `Workspace`**                  | 🚧 Partially | ✅ Available | ✅ Available |
| **Delete a `Workspace`**                  | ✅ Available  | ✅ Available | ✅ Available |
| **Edit a `Workspace`**                    | 🚧 Partially | ✅ Available | ✅ Available |
| **Create a `WorkspaceKind`**              | 🚧 Partially | ✅ Available | ✅ Available |
| **Delete a `WorkspaceKind`**              | 📆 Planned   | 📆 Planned  | 📆 Planned  |
| **Modify a `WorkspaceKind`**              | 📆 Planned   | 📆 Planned  | 📆 Planned  |
| **Apply an image redirect / deprecation** | 🚧 Partially | ✅ Available | ✅ Available |
| **Manage a `Secret`**                     | ✅ Available  | ✅ Available | ✅ Available |
| **Manage a `PersistentVolumeClaim`**      | ✅ Available  | ✅ Available | ✅ Available |
| **Culling / ACLs**                        | 📆 Planned   | 📆 Planned  | 📆 Planned  |
| **SSH access to a `Workspace`**           | 📆 Planned   | 📆 Planned  | 📆 Planned  |
| **Authentication**                        | 📆 Planned   | 📆 Planned  | 📆 Planned  |

Currently all `CustomResourceDefinitions` are unstable as denoted by `beta` their respective versions.

## Feedbacks and Bug Reporting

TBA reference CONTRIBUTING.md