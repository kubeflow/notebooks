# Kubeflow Notebooks Roadmap

Kubeflow Notebooks runs interactive development environments for AI, ML, and data workloads on Kubernetes.

## Current Release Lines

This repository currently maintains two major development lines:

- `notebooks-v1`: the stable Kubeflow Notebooks v1 codebase used by current Kubeflow platform releases.
- `notebooks-v2`: the Kubeflow Notebooks v2 codebase, also described as Kubeflow Workspaces, under active development with alpha release tags.

Kubeflow Notebooks v1 releases are tracked through semver tags such as [`v1.11.0`](https://github.com/kubeflow/notebooks/releases/tag/v1.11.0). Kubeflow Notebooks v2 alpha releases are tracked through semver tags such as [`v2.0.0-alpha.3`](https://github.com/kubeflow/notebooks/releases/tag/v2.0.0-alpha.3).

## Notebooks 2.0 / Workspaces

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

## Open Readiness Questions

The Notebooks Working Group is still using issue and release artifacts to refine readiness criteria for making Workspaces the default experience. Open questions called out in the Notebooks 2.0 discussion include:

- Whether Workspaces has feature parity with the current Notebooks web app.
- Which lifecycle controls, such as culling, are required before default adoption.
- How admins should define and evolve common pod labels, annotations, resource profiles, and runtime policies through `WorkspaceKind`.
- Which future activity probes or usage signals should be supported beyond the initial release.

## Planning References

- [Kubeflow Notebooks 2.0 / Workspaces proposal and tracking issue](https://github.com/kubeflow/notebooks/issues/85)
- [Kubeflow 1.11.0 Notebooks WG tracking issue](https://github.com/kubeflow/notebooks/issues/707)
- [Kubeflow Notebooks v1 branch](https://github.com/kubeflow/notebooks/tree/notebooks-v1)
- [Kubeflow Notebooks v2 branch](https://github.com/kubeflow/notebooks/tree/notebooks-v2)
- [Kubeflow Notebooks releases](https://github.com/kubeflow/notebooks/releases)
- [Kubeflow Notebooks planning issues](https://github.com/kubeflow/notebooks/issues?q=is%3Aissue%20label%3Akind%2Fplanning)
- [Notebooks Working Group](https://github.com/kubeflow/community/tree/master/wg-notebooks)
