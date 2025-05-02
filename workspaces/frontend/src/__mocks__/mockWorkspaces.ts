import { Workspace, WorkspaceState } from '~/shared/types';

export const mockWorkspaces: Workspace[] = [
  {
    name: 'My Jupyter Notebook',
    namespace: 'namespace1',
    paused: true,
    deferUpdates: true,
    kind: 'jupyter-lab',
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
  },
  {
    name: 'My Other Jupyter Notebook',
    namespace: 'namespace1',
    paused: false,
    deferUpdates: false,
    kind: 'jupyter-lab',
    cpu: 1,
    ram: 12540,
    podTemplate: {
      podMetadata: {
        labels: ['label1', 'label2'],
        annotations: ['annotation1', 'annotation2'],
      },
      volumes: {
        home: '/home',
        data: [
          {
            pvcName: 'PVC-1',
            mountPath: '/data',
            readOnly: false,
          },
        ],
      },
      endpoints: [
        {
          displayName: 'JupyterLab',
          port: '8888',
        },
        {
          displayName: 'Spark Master',
          port: '9999',
        },
      ],
    },
    options: {
      imageConfig: 'jupyterlab_scipy_180',
      podConfig: 'Large CPU',
    },
    status: {
      activity: {
        lastActivity: 0,
        lastUpdate: 0,
      },
      pauseTime: 0,
      pendingRestart: false,
      podTemplateOptions: {
        imageConfig: {
          desired: '',
          redirectChain: [],
        },
      },
      state: WorkspaceState.Running,
      stateMessage: 'It is running.',
    },
    redirectStatus: {
      level: 'Danger',
      text: 'This is dangerous',
    },
  },
];
