import {
  WorkspacekindsRedirectMessageLevel,
  type WorkspacekindsWorkspaceKind,
} from '~/generated/data-contracts';

// Factory function to create a valid WorkspaceKind
function createMockWorkspaceKind(
  overrides: Partial<WorkspacekindsWorkspaceKind> = {},
): WorkspacekindsWorkspaceKind {
  return {
    name: 'jupyter-lab',
    displayName: 'JupyterLab Notebook',
    description: 'A Workspace which runs JupyterLab in a Pod',
    deprecated: false,
    deprecationMessage: '',
    hidden: false,
    icon: {
      url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
    },
    logo: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
    },
    podTemplate: {
      podMetadata: {
        labels: { myWorkspaceKindLabel: 'my-value' },
        annotations: { myWorkspaceKindAnnotation: 'my-value' },
      },
      volumeMounts: { home: '/home/jovyan' },
      options: {
        imageConfig: {
          default: 'jupyterlab_scipy_190',
          values: [
            {
              id: 'jupyterlab_scipy_180',
              description: 'JupyterLab with SciPy 1.8.0',
              displayName: 'jupyter-scipy:v1.8.0',
              labels: [{ key: 'pythonVersion', value: '3.11' }],
              hidden: true,
              redirect: {
                to: 'jupyterlab_scipy_190',
                message: {
                  text: 'This update will change...',
                  level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
                },
              },
            },
          ],
        },
        podConfig: {
          default: 'tiny_cpu',
          values: [
            {
              id: 'tiny_cpu',
              hidden: false,
              displayName: 'Tiny CPU',
              description: 'Pod with 0.1 CPU, 128 Mb RAM',
              labels: [
                { key: 'cpu', value: '100m' },
                { key: 'memory', value: '128Mi' },
              ],
            },
          ],
        },
      },
    },
    ...overrides, // Allows customization
  };
}

// Generate valid mock data with "data" property
export const mockWorkspaceKindsValid = {
  data: [createMockWorkspaceKind()],
};

// Generate invalid mock data with "data" property
export const mockWorkspaceKindsInValid = {
  data: [
    createMockWorkspaceKind({
      logo: {
        url: '',
      },
    }),
  ],
};
