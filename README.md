# Kubeflow Notebooks
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9942/badge)](https://www.bestpractices.dev/projects/9942)

[Kubeflow Notebooks](https://www.kubeflow.org/docs/components/notebooks/overview/) lets you run web-based development environments on your Kubernetes cluster by running them inside Pods.

> ⚠️ __Note__ ⚠️
>
> We are currently moving the _Kubeflow Notebooks 1.0_ codebase from [`kubeflow/kubeflow`](https://github.com/kubeflow/kubeflow) to this repository ([`kubeflow/notebooks`](https://github.com/kubeflow/notebooks)).
> Please see [`kubeflow/kubeflow#7549`](https://github.com/kubeflow/kubeflow/issues/7549) for more information.
>
> We are currently developing _Kubeflow Notebooks 2.0_ in this repository under the [`notebooks-v2`](https://github.com/kubeflow/notebooks/tree/notebooks-v2) branch.
> Please see [`kubeflow/notebooks#85`](https://github.com/kubeflow/notebooks/issues/85) for more information.

## What is Kubeflow Notebooks?

Key features of Kubeflow Notebooks:

- Native support for [JupyterLab](https://github.com/jupyterlab/jupyterlab), [RStudio](https://github.com/rstudio/rstudio), and [Visual Studio Code (code-server)](https://github.com/coder/code-server).
- Users can [create notebook containers](https://www.kubeflow.org/docs/components/notebooks/quickstart-guide/) directly in the cluster, rather than locally on their workstations.
- Admins can provide [standard notebook images](https://www.kubeflow.org/docs/components/notebooks/container-images/) for their organization with required packages pre-installed.
- Access control is managed by [Kubeflow’s RBAC](https://www.kubeflow.org/docs/components/central-dash/profiles/), enabling easier notebook sharing across the organization.

## Installation

Kubeflow Notebooks is designed to be deployed as part of a [Kubeflow Platform](https://www.kubeflow.org/docs/started/introduction/#what-is-kubeflow-platform) (not as a standalone component).

Please refer to the [Installing Kubeflow](https://www.kubeflow.org/docs/started/installing-kubeflow/) page for more information.

## Documentation

The official documentation for Kubeflow Notebooks can be found [here](https://www.kubeflow.org/docs/components/notebooks/).

## Community

Kubeflow Notebooks is part of the Kubeflow project, refer to the [Kubeflow Community](https://www.kubeflow.org/docs/about/community/) page for more information.

Connect with _other users_ and the [Notebooks Working Group](https://github.com/kubeflow/community/tree/master/wg-notebooks) (maintainers of Kubeflow Notebooks) in the following places:

- [Kubeflow Slack](https://www.kubeflow.org/docs/about/community/#kubeflow-slack-channels) - Join the [`#kubeflow-notebooks`](https://cloud-native.slack.com/archives/C073W562HFY) channel.
- [Kubeflow Mailing List](https://groups.google.com/g/kubeflow-discuss)

## Contributing

Please see the [`CONTRIBUTING.md`](CONTRIBUTING.md) file for more information.
