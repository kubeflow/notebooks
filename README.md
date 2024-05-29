# Kubeflow Notebooks

[Kubeflow Notebooks](https://www.kubeflow.org/docs/components/notebooks/overview/) lets you run web-based development environments on your Kubernetes cluster by running them inside Pods.

## What is Kubeflow Notebooks?

Key features of Kubeflow Notebooks:

- Native support for [JupyterLab](https://github.com/jupyterlab/jupyterlab), [RStudio](https://github.com/rstudio/rstudio), and [Visual Studio Code (code-server)](https://github.com/coder/code-server).
- Users can [create notebook containers](https://www.kubeflow.org/docs/components/notebooks/quickstart-guide/) directly in the cluster, rather than locally on their workstations.
- Admins can provide [standard notebook images](https://www.kubeflow.org/docs/components/notebooks/container-images/) for their organization with required packages pre-installed.
- Access control is managed by [Kubeflow’s RBAC](https://www.kubeflow.org/docs/components/central-dash/profiles/), enabling easier notebook sharing across the organization.

## Installation

Currently, Kubeflow Notebooks must be deployed as part of a full Kubeflow platform (not as a standalone component).

Please refer to the [Installing Kubeflow](https://www.kubeflow.org/docs/started/installing-kubeflow/) page for more information.

## Documentation

The official documentation for Kubeflow Notebooks can be found [here](https://www.kubeflow.org/docs/components/notebooks/).

## Community

Kubeflow Notebooks is part of the Kubeflow project, refer to the [Kubeflow Community](https://www.kubeflow.org/docs/about/community/) page for more information.

Connect with _other users_ and the [Notebooks Working Group](https://github.com/kubeflow/community/tree/master/wg-notebooks) in the following places:

- [Kubeflow Slack](https://www.kubeflow.org/docs/about/community/#kubeflow-slack) - Join the [`#kubeflow-notebooks`](https://kubeflow.slack.com/archives/CESP7FCQ7) channel.
- [Kubeflow Mailing List](https://groups.google.com/g/kubeflow-discuss)

## Contributing

> ⚠️ __Note__ ⚠️
> 
> We are currently moving the Kubeflow Notebooks codebase from [`kubeflow/kubeflow`](https://github.com/kubeflow/kubeflow) to this repository ([`kubeflow/notebooks`](https://github.com/kubeflow/notebooks)).
> For now, please continue to make contributions by raising PRs on `kubeflow/kubeflow`.

Please see the [Contributing to Kubeflow](https://www.kubeflow.org/docs/about/contributing/) page for more information.
