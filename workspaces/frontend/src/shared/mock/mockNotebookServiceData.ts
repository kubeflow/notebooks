import {
  WorkspacekindsWorkspaceKind,
  WorkspacesWorkspace,
  WorkspacesWorkspaceKindInfo,
  WorkspacesWorkspaceState,
} from '~/generated/data-contracts';
import {
  buildMockHealthCheckResponse,
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceList,
} from '~/shared/mock/mockBuilder';

// Health
export const mockedHealthCheckResponse = buildMockHealthCheckResponse();

// Namespace
export const mockNamespace1 = buildMockNamespace({ name: 'workspace-test-1' });
export const mockNamespace2 = buildMockNamespace({ name: 'workspace-test-2' });
export const mockNamespace3 = buildMockNamespace({ name: 'workspace-test-3' });

export const mockNamespaces = [mockNamespace1, mockNamespace2, mockNamespace3];

// WorkspaceKind
export const mockWorkspaceKind1: WorkspacekindsWorkspaceKind = buildMockWorkspaceKind({
  name: 'jupyterlab1',
  displayName: 'JupyterLab Notebook 1',
  clusterMetrics: {
    workspacesCount: 18,
  },
});

export const mockWorkspaceKind2: WorkspacekindsWorkspaceKind = buildMockWorkspaceKind({
  name: 'jupyterlab2',
  displayName: 'JupyterLab Notebook 2',
  clusterMetrics: {
    workspacesCount: 2,
  },
});

export const mockWorkspaceKind3: WorkspacekindsWorkspaceKind = buildMockWorkspaceKind({
  name: 'jupyterlab3',
  displayName: 'JupyterLab Notebook 3',
  clusterMetrics: {
    workspacesCount: 0,
  },
});

export const mockWorkspaceKinds = [mockWorkspaceKind1, mockWorkspaceKind2, mockWorkspaceKind3];

export const mockWorkspaceKindInfo1: WorkspacesWorkspaceKindInfo = buildMockWorkspaceKindInfo({
  name: mockWorkspaceKind1.name,
});

export const mockWorkspaceKindInfo2: WorkspacesWorkspaceKindInfo = buildMockWorkspaceKindInfo({
  name: mockWorkspaceKind2.name,
});

// Workspace
export const mockWorkspace1: WorkspacesWorkspace = buildMockWorkspace({
  workspaceKind: mockWorkspaceKindInfo1,
  namespace: mockNamespace1.name,
});

export const mockWorkspace2: WorkspacesWorkspace = buildMockWorkspace({
  name: 'My Second Jupyter Notebook',
  workspaceKind: mockWorkspaceKindInfo1,
  namespace: mockNamespace2.name,
  state: WorkspacesWorkspaceState.WorkspaceStatePaused,
  paused: false,
  deferUpdates: false,
  activity: {
    lastActivity: new Date(2024, 11, 31).getTime(),
    lastUpdate: new Date(2024, 11, 20).getTime(),
  },
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
          pvcName: 'PVC-1',
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
          id: 'large_cpu',
          displayName: 'Large CPU',
          description: 'Pod with 4 CPU, 16 Gb RAM',
          labels: [
            {
              key: 'cpu',
              value: '4000m',
            },
            {
              key: 'memory',
              value: '16Gi',
            },
            {
              key: 'gpu',
              value: '4',
            },
          ],
        },
      },
    },
  },
});

export const mockWorkspace3: WorkspacesWorkspace = buildMockWorkspace({
  name: 'My Third Jupyter Notebook',
  namespace: mockNamespace1.name,
  workspaceKind: mockWorkspaceKindInfo1,
  state: WorkspacesWorkspaceState.WorkspaceStateRunning,
  pendingRestart: true,
  activity: {
    lastActivity: new Date(2025, 2, 15).getTime(),
    lastUpdate: new Date(2025, 2, 1).getTime(),
  },
});

export const mockWorkspace4: WorkspacesWorkspace = buildMockWorkspace({
  name: 'My Fourth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: WorkspacesWorkspaceState.WorkspaceStateError,
  workspaceKind: mockWorkspaceKindInfo2,
});

export const mockWorkspace5: WorkspacesWorkspace = buildMockWorkspace({
  name: 'My Fifth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: WorkspacesWorkspaceState.WorkspaceStateTerminating,
  workspaceKind: mockWorkspaceKindInfo2,
});

export const mockAllWorkspaces = [
  mockWorkspace1,
  mockWorkspace2,
  mockWorkspace3,
  mockWorkspace4,
  mockWorkspace5,
  ...buildMockWorkspaceList({
    count: 15,
    namespace: mockNamespace1.name,
    kind: mockWorkspaceKindInfo1,
  }),
];
