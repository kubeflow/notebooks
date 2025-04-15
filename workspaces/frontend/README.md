# Kubeflow Workspaces Frontend
The Kubeflow Workspaces Frontend is the web user interface used to monitor and manage Kubeflow Workspaces as part of [Kubeflow Notebooks 2.0](https://github.com/kubeflow/kubeflow/issues/7156).

> ⚠️ __Warning__ ⚠️
>
> The Kubeflow Workspaces Frontend is a work in progress and is __NOT__ currently ready for use.
> We greatly appreciate any contributions.

# Dev Setup

## Requirements

This project requires the following tools to be installed on your system:

- [NodeJS and NPM](https://nodejs.org/)
  - Node recommended version -> `20.17.0`
  - NPM recommended version -> `10.8.2`

## Development

1. Clone the repository:

      ``` bash
      git clone https://github.com/kubeflow/notebooks.git
      ```

2. Checkout the Notebooks 2.0 development branch:

      ``` bash
      git checkout notebooks-v2
      ```

3. Navigate to the `frontend` directory and install the project dependencies.

     ```bash
     cd workspaces/frontend && npm install
     ```

### Build the Project

  ```bash
  npm run build
  ```

### Serve the UI Locally

This is the default setup for running the UI locally. Make sure you build the project using the instructions above prior to running the command below.

  ```bash
  npm run start:dev
  ```

### Testing

Run all tests:

  ```bash
  npm run test
  ```

### Linting

Check for linting issues:

  ```bash
  npm run test:lint
  ```

Automatically fix linting issues:

  ```bash
  npm run test:fix
  ```
