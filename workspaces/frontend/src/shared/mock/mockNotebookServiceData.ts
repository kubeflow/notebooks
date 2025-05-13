import {
  Workspace,
  WorkspaceKind,
  WorkspaceKindInfo,
  WorkspaceState,
} from '~/shared/api/backendApiTypes';
import {
  buildMockHealthCheckResponse,
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
} from '~/shared/mock/mockBuilder';

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

export const mockWorkspaceKindInfo1: WorkspaceKindInfo = buildMockWorkspaceKindInfo({
  name: mockWorkspaceKind1.name,
});

export const mockWorkspaceKindInfo2: WorkspaceKindInfo = buildMockWorkspaceKindInfo({
  name: mockWorkspaceKind2.name,
});

// Workspace
export const mockWorkspace1: Workspace = buildMockWorkspace({
  workspaceKind: mockWorkspaceKindInfo1,
  namespace: mockNamespace1.name,
});

export const mockWorkspace2: Workspace = buildMockWorkspace({
  name: 'My Second Jupyter Notebook',
  workspaceKind: mockWorkspaceKindInfo1,
  namespace: mockNamespace1.name,
  state: WorkspaceState.WorkspaceStatePaused,
  paused: false,
  deferUpdates: false,
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
          ],
        },
      },
    },
  },
});

export const mockWorkspace3: Workspace = buildMockWorkspace({
  name: 'My Third Jupyter Notebook',
  namespace: mockNamespace1.name,
  workspaceKind: mockWorkspaceKindInfo1,
  state: WorkspaceState.WorkspaceStateRunning,
  pendingRestart: true,
});

export const mockWorkspace4 = buildMockWorkspace({
  name: 'My Fourth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: WorkspaceState.WorkspaceStateError,
  workspaceKind: mockWorkspaceKindInfo2,
});

export const mockWorkspace5 = buildMockWorkspace({
  name: 'My Fifth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: WorkspaceState.WorkspaceStateTerminating,
  workspaceKind: mockWorkspaceKindInfo2,
});

export const mockAllWorkspaces = [
  mockWorkspace1,
  mockWorkspace2,
  mockWorkspace3,
  mockWorkspace4,
  mockWorkspace5,
];
