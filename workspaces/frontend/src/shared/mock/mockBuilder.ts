import {
  HealthCheckResponse,
  Namespace,
  Workspace,
  WorkspaceKind,
  WorkspaceState,
} from '~/shared/types';

export const buildMockHealthCheckResponse = (
  healthCheckResponse?: Partial<HealthCheckResponse>,
): HealthCheckResponse => ({
  status: 'Healthy',
  systemInfo: { version: '1.0.0' },
  ...healthCheckResponse,
});

export const buildMockNamespace = (namespace?: Partial<Namespace>): Namespace => ({
  name: 'default',
  ...namespace,
});

export const buildMockWorkspace = (workspace?: Partial<Workspace>): Workspace => ({
  name: 'My Jupyter Notebook',
  namespace: 'default',
  paused: true,
  deferUpdates: true,
  kind: 'jupyterlab',
  cpu: 3,
  ram: 500,
  podTemplate: {
    podMetadata: {
      labels: ['label1', 'label2'],
      annotations: ['annotation1', 'annotation2'],
    },
    volumes: {
      home: '/home',
      data: [
        {
          pvcName: 'Volume-1',
          mountPath: '/data',
          readOnly: true,
        },
        {
          pvcName: 'Volume-2',
          mountPath: '/data',
          readOnly: false,
        },
      ],
    },
    endpoints: [
      {
        displayName: 'JupyterLab',
        port: '7777',
      },
    ],
  },
  options: {
    imageConfig: 'jupyterlab_scipy_180',
    podConfig: 'Small CPU',
  },
  status: {
    activity: {
      lastActivity: 1739673600,
      lastUpdate: 1739673700,
    },
    pauseTime: 1739673500,
    pendingRestart: false,
    podTemplateOptions: {
      imageConfig: {
        desired: '',
        redirectChain: [],
      },
    },
    state: WorkspaceState.Paused,
    stateMessage: 'It is paused.',
  },
  redirectStatus: {
    level: 'Info',
    text: 'This is informational',
  },
  ...workspace,
});

export const buildMockWorkspaceKind = (workspaceKind?: Partial<WorkspaceKind>): WorkspaceKind => ({
  name: 'jupyterlab',
  displayName: 'JupyterLab Notebook',
  description:
    'Example of a description for JupyterLab a Workspace which runs JupyterLab in a Pod.',
  deprecated: true,
  deprecationMessage:
    'This WorkspaceKind was removed on 20XX-XX-XX, please use another WorkspaceKind.',
  hidden: false,
  icon: {
    url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
  },
  logo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
  },
  podTemplate: {
    podMetadata: {
      labels: {
        myWorkspaceKindLabel: 'my-value',
      },
      annotations: {
        myWorkspaceKindAnnotation: 'my-value',
      },
    },
    volumeMounts: {
      home: '/home/jovyan',
    },
    options: {
      imageConfig: {
        default: 'jupyterlab_scipy_190',
        values: [
          {
            id: 'jupyterlab_scipy_180',
            displayName: 'jupyter-scipy:v1.8.0',
            labels: { pythonVersion: '3.11', jupyterlabVersion: '1.8.0' },
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_190',
              message: {
                text: 'This update will change...',
                level: 'Info',
              },
            },
          },
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            labels: { pythonVersion: '3.12', jupyterlabVersion: '1.9.0' },
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_200',
              message: {
                text: 'This update will change...',
                level: 'Warning',
              },
            },
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0',
            labels: { pythonVersion: '3.12', jupyterlabVersion: '2.0.0' },
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_210',
              message: {
                text: 'This update will change...',
                level: 'Warning',
              },
            },
          },
          {
            id: 'jupyterlab_scipy_210',
            displayName: 'jupyter-scipy:v2.1.0',
            labels: { pythonVersion: '3.13', jupyterlabVersion: '2.1.0' },
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_220',
              message: {
                text: 'This update will change...',
                level: 'Warning',
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
            displayName: 'Tiny CPU',
            description: 'Pod with 0.1 CPU, 128 Mb RAM',
            labels: { cpu: '100m', memory: '128Mi' },
            redirect: {
              to: 'small_cpu',
              message: {
                text: 'This update will change...',
                level: 'Danger',
              },
            },
          },
          {
            id: 'large_cpu',
            displayName: 'Large CPU',
            description: 'Pod with 1 CPU, 1 Gb RAM',
            labels: { cpu: '1000m', memory: '1Gi' },
          },
        ],
      },
    },
  },
  ...workspaceKind,
});
