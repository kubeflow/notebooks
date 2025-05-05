import {
  buildMockHealthCheckResponse,
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
} from '~/shared/mock/mockBuilder';
import { Workspace, WorkspaceKind, WorkspaceState } from '~/shared/types';

// Health
export const mockedHealthCheckResponse = buildMockHealthCheckResponse();

// Namespace
export const mockNamespace1 = buildMockNamespace({ name: 'workspace-test-1' });
export const mockNamespace2 = buildMockNamespace({ name: 'workspace-test-2' });
export const mockNamespace3 = buildMockNamespace({ name: 'workspace-test-3' });

export const mockNamespaces = [mockNamespace1, mockNamespace2, mockNamespace3];

// WorkspaceKind
export const mockWorkspaceKind1: WorkspaceKind = buildMockWorkspaceKind({
  name: 'jupyterlab1',
  displayName: 'JupyterLab Notebook 1',
});

export const mockWorkspaceKind2: WorkspaceKind = buildMockWorkspaceKind({
  name: 'jupyterlab2',
  displayName: 'JupyterLab Notebook 2',
});

export const mockWorkspaceKind3: WorkspaceKind = buildMockWorkspaceKind({
  name: 'jupyterlab3',
  displayName: 'JupyterLab Notebook 3',
});

export const mockWorkspaceKinds = [mockWorkspaceKind1, mockWorkspaceKind2, mockWorkspaceKind3];

// Workspace
export const mockWorkspace1: Workspace = buildMockWorkspace({
  kind: mockWorkspaceKind1.name,
  namespace: mockNamespace1.name,
});

export const mockWorkspace2: Workspace = buildMockWorkspace({
  name: 'My Other Jupyter Notebook',
  kind: mockWorkspaceKind1.name,
  namespace: mockNamespace1.name,
  paused: false,
  deferUpdates: false,
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
    pauseTime: 1739673500,
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
});

export const mockWorkspace3 = buildMockWorkspace({
  name: 'My Third Jupyter Notebook',
  namespace: mockNamespace2.name,
  kind: mockWorkspaceKind2.name,
});

export const mockWorkspace4 = buildMockWorkspace({
  name: 'My Fourth Jupyter Notebook',
  namespace: mockNamespace2.name,
  kind: mockWorkspaceKind2.name,
});

export const mockAllWorkspaces = [mockWorkspace1, mockWorkspace2, mockWorkspace3, mockWorkspace4];
