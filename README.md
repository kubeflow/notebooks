# Kubeflow Notebooks
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9942/badge)](https://www.bestpractices.dev/projects/9942)

[Kubeflow Notebooks](https://www.kubeflow.org/docs/components/notebooks/overview/) runs __interactive development environments__ for AI, ML, and Data workloads on __Kubernetes__.

> [!NOTE]
>
> This repository contains two major versions of Kubeflow Notebooks:
>
> - The [`notebooks-v1`](https://github.com/kubeflow/notebooks/tree/notebooks-v1) branch contains the codebase for _Kubeflow Notebooks v1_.
> - The [`notebooks-v2`](https://github.com/kubeflow/notebooks/tree/notebooks-v2) branch contains the codebase for _Kubeflow Notebooks v2_.

## What is Kubeflow Notebooks?

Key features of Kubeflow Notebooks:

- Native support for [JupyterLab](https://github.com/jupyterlab/jupyterlab), [RStudio](https://github.com/rstudio/rstudio), and [Visual Studio Code (code-server)](https://github.com/coder/code-server).
- Users can [create notebook containers](https://www.kubeflow.org/docs/components/notebooks/quickstart-guide/) directly in the cluster, rather than locally on their workstations.
- Admins can provide [standard notebook images](https://www.kubeflow.org/docs/components/notebooks/container-images/) for their organization with required packages pre-installed.
- Access control is managed by [Kubeflow’s RBAC](https://www.kubeflow.org/docs/components/central-dash/profiles/), enabling easier notebook sharing across the organization.

## Documentation

The official documentation for Kubeflow Notebooks can be found [here](https://www.kubeflow.org/docs/components/notebooks/).

## Community

Kubeflow Notebooks is part of the Kubeflow project, refer to the [Kubeflow Community](https://www.kubeflow.org/docs/about/community/) page for more information.

Connect with _other users_ and the [Notebooks Working Group](https://github.com/kubeflow/community/tree/master/wg-notebooks) (maintainers of Kubeflow Notebooks) in the following places:

- [Kubeflow Slack](https://www.kubeflow.org/docs/about/community/#kubeflow-slack-channels) - Join the [`#kubeflow-notebooks`](https://cloud-native.slack.com/archives/C073W562HFY) channel.
- [Kubeflow Mailing List](https://groups.google.com/g/kubeflow-discuss)

## Contributing

Please see the [`CONTRIBUTING.md`](https://github.com/kubeflow/notebooks/blob/main/CONTRIBUTING.md) file for more information.