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

The command above starts the UI with mocked data by default, so you can run the application without requiring a connection to the backend. This behavior can be customized in the `.env.development` file by setting the `MOCK_API_ENABLED` environment variable to `false`.

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

### API Types & Client Generation

The TypeScript types and the HTTP client layer for interacting with the backend APIs are automatically generated from the backend's `swagger.json` file. This ensures the frontend remains aligned with the backend API contract at all times.

#### Generated Code Location

All generated files live in the `src/generated` directory.

⚠️ Do not manually edit any files in this folder.

#### Updating the Generated Code

To update the generated code, first update the `swagger.version` file in the `scripts` directory to the desired commit hash of the backend's `swagger.json` file.

Then run the following command to update the generated code:

```bash
npm run generate:api
```

Finally, make any necessary adaptations based on the changes in the generated code.