import {
  HealthCheckResponse,
  Namespace,
  Workspace,
  WorkspaceKind,
  WorkspaceKindInfo,
  WorkspaceRedirectMessageLevel,
  WorkspaceServiceStatus,
  WorkspaceState,
} from '~/shared/api/backendApiTypes';

export const buildMockHealthCheckResponse = (
  healthCheckResponse?: Partial<HealthCheckResponse>,
): HealthCheckResponse => ({
  status: WorkspaceServiceStatus.ServiceStatusHealthy,
  systemInfo: { version: '1.0.0' },
  ...healthCheckResponse,
});

export const buildMockNamespace = (namespace?: Partial<Namespace>): Namespace => ({
  name: 'default',
  ...namespace,
});

export const buildMockWorkspaceKindInfo = (
  workspaceKindInfo?: Partial<WorkspaceKindInfo>,
): WorkspaceKindInfo => ({
  name: 'jupyterlab',
  missing: false,
  icon: {
    url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
  },
  logo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
  },
  ...workspaceKindInfo,
});

export const buildMockWorkspace = (workspace?: Partial<Workspace>): Workspace => ({
  name: 'My First Jupyter Notebook',
  namespace: 'default',
  workspaceKind: buildMockWorkspaceKindInfo(),
  paused: true,
  deferUpdates: true,
  pausedTime: 1739673500,
  state: WorkspaceState.WorkspaceStateRunning,
  stateMessage: 'Workspace is running',
  podTemplate: {
    podMetadata: {
      labels: { labelKey1: 'labelValue1', labelKey2: 'labelValue2' },
      annotations: { annotationKey1: 'annotationValue1', annotationKey2: 'annotationValue2' },
    },
    volumes: {
      home: {
        pvcName: 'Volume-Home',
        mountPath: '/home',
        readOnly: false,
      },
      data: [
        {
          pvcName: 'Volume-Data1',
          mountPath: '/data',
          readOnly: true,
        },
        {
          pvcName: 'Volume-Data2',
          mountPath: '/data',
          readOnly: false,
        },
      ],
    },
    options: {
      imageConfig: {
        current: {
          id: 'jupyterlab_scipy_190',
          displayName: 'jupyter-scipy:v1.9.0',
          description: 'JupyterLab, with SciPy Packages',
          labels: [
            {
              key: 'pythonVersion',
              value: '3.11',
            },
          ],
        },
      },
      podConfig: {
        current: {
          id: 'tiny_cpu',
          displayName: 'Tiny CPU',
          description: 'Pod with 0.1 CPU, 128 Mb RAM',
          labels: [
            {
              key: 'cpu',
              value: '100m',
            },
            {
              key: 'memory',
              value: '128Mi',
            },
          ],
        },
      },
    },
  },
  activity: {
    lastActivity: 1746551485113,
    lastUpdate: 1746551485113,
  },
  pendingRestart: false,
  services: [
    {
      httpService: {
        displayName: 'JupyterLab',
        httpPath: 'https://jupyterlab.example.com',
      },
    },
    {
      httpService: {
        displayName: 'Spark Master',
        httpPath: 'https://spark-master.example.com',
      },
    },
  ],
  ...workspace,
});

export const buildMockWorkspaceKind = (workspaceKind?: Partial<WorkspaceKind>): WorkspaceKind => ({
  name: 'jupyterlab',
  displayName: 'JupyterLab Notebook',
  description: 'A Workspace which runs JupyterLab in a Pod',
  deprecated: false,
  deprecationMessage:
    'This WorkspaceKind will be removed on 20XX-XX-XX, please use another WorkspaceKind.',
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
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.11' },
              { key: 'jupyterlabVersion', value: '1.8.0' },
            ],
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_190',
              message: {
                text: 'This update will change...',
                level: WorkspaceRedirectMessageLevel.RedirectMessageLevelInfo,
              },
            },
          },
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.12' },
              { key: 'jupyterlabVersion', value: '1.9.0' },
            ],
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_200',
              message: {
                text: 'This update will change...',
                level: WorkspaceRedirectMessageLevel.RedirectMessageLevelWarning,
              },
            },
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.12' },
              { key: 'jupyterlabVersion', value: '2.0.0' },
            ],
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_210',
              message: {
                text: 'This update will change...',
                level: WorkspaceRedirectMessageLevel.RedirectMessageLevelWarning,
              },
            },
          },
          {
            id: 'jupyterlab_scipy_210',
            displayName: 'jupyter-scipy:v2.1.0',
            description: 'JupyterLab, with SciPy Packages',
            labels: [
              { key: 'pythonVersion', value: '3.13' },
              { key: 'jupyterlabVersion', value: '2.1.0' },
            ],
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_220',
              message: {
                text: 'This update will change...',
                level: WorkspaceRedirectMessageLevel.RedirectMessageLevelWarning,
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
            hidden: false,
            labels: [
              { key: 'cpu', value: '100m' },
              { key: 'memory', value: '128Mi' },
            ],
            redirect: {
              to: 'small_cpu',
              message: {
                text: 'This update will change...',
                level: WorkspaceRedirectMessageLevel.RedirectMessageLevelDanger,
              },
            },
          },
          {
            id: 'large_cpu',
            displayName: 'Large CPU',
            description: 'Pod with 1 CPU, 1 Gb RAM',
            hidden: false,
            labels: [
              { key: 'cpu', value: '1000m' },
              { key: 'memory', value: '1Gi' },
              { key: 'gpu', value: '1' },
            ],
            redirect: {
              to: 'large_cpu',
              message: {
                text: 'This update will change...',
                level: WorkspaceRedirectMessageLevel.RedirectMessageLevelDanger,
              },
            },
          },
        ],
      },
    },
  },
  ...workspaceKind,
});
