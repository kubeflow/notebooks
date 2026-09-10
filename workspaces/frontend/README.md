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
  - Node recommended version -> `24.0.0`
  - NPM recommended version -> `11.10.0`

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

### Styling and Kubeflow Integration

The Workspaces frontend uses [PatternFly](https://www.patternfly.org/) components for its UI and also depends on the Kubeflow `mod-arch` libraries for integration with the wider Kubeflow user experience.

As a result, the effective styling of a component can depend on the environment in which the frontend is rendered.

The main styling layers are:

1. **PatternFly** provides the base components and their semantic theme variables.
2. **`mod-arch-kubeflow` / MUI compatibility styling** adapts components to the Kubeflow theme when `.mui-theme` is active.
3. **Local application styles** in `src/app/app.css` provide Workspaces-specific styling and narrowly scoped compatibility overrides where required.

#### Standalone and Kubeflow-integrated rendering

The Workspaces frontend can be rendered standalone during development and can also be embedded in the Kubeflow UI, such as through the Central Dashboard.

These environments may load styling layers in a different order. When selectors have similar specificity, this can change which CSS custom-property mapping wins the cascade even when the underlying PatternFly variant variables are correct.

For UI changes that may be affected by theming, contributors should verify the component in both the standalone Workspaces UI and the Kubeflow-integrated UI when possible.

#### Styling guidelines

When resolving cross-theme styling differences:

- Prefer PatternFly semantic or variant CSS variables over hard-coded colors, spacing, or dimensions.
- Scope compatibility overrides to the affected Workspaces component rather than overriding PatternFly components globally.
- Before adding an override, compare the final computed property with the corresponding PatternFly variant and theme variables.
- Use browser developer tools to identify the winning declaration and check selector specificity and stylesheet order.
- Verify relevant interaction states such as hover, focus, disabled, and expanded states.

### Testing

Run all tests:

  ```bash
  npm run test
  ```

#### Code Coverage

Code coverage is collected from both **Jest** (unit tests) and **Cypress** (mocked UI tests), then merged into a single unified report.

Run coverage:

  ```bash
  npm run test:coverage
  ```

This command runs both test suites with coverage instrumentation and merges the results. Coverage stats will be printed to the terminal upon completion.

To view the detailed HTML report, open `coverage/report/index.html` in your browser.

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
