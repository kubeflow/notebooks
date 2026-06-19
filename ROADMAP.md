# Kubeflow Notebooks Roadmap

Kubeflow Notebooks runs interactive development environments for AI, ML, and data workloads on Kubernetes.

## Current Releases

This repository maintains two development branches and follows [semver](https://semver.org/) for versioning:

- `notebooks-v1`: the stable Kubeflow Notebooks v1 codebase used by current Kubeflow platform releases.
- `notebooks-v2`: the Kubeflow Notebooks v2 codebase, also described as Kubeflow Workspaces, under active development with alpha release tags.

## Notebooks 2.0 / Kubeflow Workspaces

The primary forward-looking roadmap for Kubeflow Notebooks is [Kubeflow Notebooks 2.0 / Kubeflow Workspaces](https://github.com/kubeflow/notebooks/issues/85). Notebooks 2.0 is intended to make running IDEs on Kubernetes better for both end users and cluster admins by introducing higher-level workspace abstractions instead of exposing users directly to raw pod specs.

The roadmap is organized around three new components in the [`notebooks-v2`](https://github.com/kubeflow/notebooks/tree/notebooks-v2) branch:

- [Workspace Controller](https://github.com/kubeflow/notebooks/tree/notebooks-v2/workspaces/controller): reconciles `Workspace` and `WorkspaceKind` resources and provides validation webhooks.
- [Workspace Backend API](https://github.com/kubeflow/notebooks/tree/notebooks-v2/workspaces/backend): provides the backend-for-frontend REST API between the UI and Kubernetes.
- [Workspace Frontend](https://github.com/kubeflow/notebooks/tree/notebooks-v2/workspaces/frontend): lets users create, edit, connect to, and manage Workspaces.

The key API direction is to split the existing Notebook model into:

- `Workspace`: a namespaced resource created by users through the UI or `kubectl`.
- `WorkspaceKind`: a cluster resource defined by admins to describe templates such as JupyterLab, VS Code, or RStudio, including approved images and pod configurations.

## Roadmap Themes

Near-term work is focused on:

- Maintaining the stable Notebooks v1 experience for current Kubeflow platform users.
- Developing and validating Notebooks v2 / Workspaces through alpha releases.
- Providing admin-defined `WorkspaceKind` templates so users can choose IDE, image, pod configuration, and volumes without understanding all Kubernetes pod details.
- Supporting safer workspace updates, including image and pod-configuration changes managed by admins.
- Improving support for resource-sensitive environments, including GPU-oriented pod configurations and future lifecycle controls such as culling or maximum runtime policies.
- Preserving a path for users to opt into Workspaces before it becomes the default Notebooks experience.

For detailed epics and tracking, see the [Kubeflow Notebooks project board](https://github.com/orgs/kubeflow/projects/62).

## Planning References

- [Kubeflow Notebooks 2.0 / Workspaces proposal and tracking issue](https://github.com/kubeflow/notebooks/issues/85)
- [Kubeflow Notebooks v1 branch](https://github.com/kubeflow/notebooks/tree/notebooks-v1)
- [Kubeflow Notebooks v2 branch](https://github.com/kubeflow/notebooks/tree/notebooks-v2)
- [Kubeflow Notebooks releases](https://github.com/kubeflow/notebooks/releases)
- [Kubeflow Notebooks planning board](https://github.com/orgs/kubeflow/projects/62)
- [Notebooks Working Group](https://github.com/kubeflow/community/tree/master/wg-notebooks)
