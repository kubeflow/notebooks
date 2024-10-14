# Kubeflow Workspaces Frontend
The Kubeflow Workspaces Frontend is the web user interface used to monitor and manage Kubeflow Workspaces as part of [Kubeflow Notebooks 2.0](https://github.com/kubeflow/kubeflow/issues/7156).

> ⚠️ __Warning__ ⚠️
>
> The Kubeflow Workspaces Frontend is a work in progress and is __NOT__ currently ready for use.
> We greatly appreciate any contributions.


## Pre-requisites:

Node v20

## Development

```sh
# Install development/build dependencies
npm install

# Start the development server
npm run start:dev

# Run a production build (outputs to "dist" dir)
npm run build

# Run the unit test suite
npm run test:jest

# Start the express server (run a production build first)
npm run start
```
