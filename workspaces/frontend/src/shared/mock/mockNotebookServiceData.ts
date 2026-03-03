import {
  SecretsSecretCreate,
  WorkspacekindsWorkspaceKind,
  WorkspacesRedirectMessageLevel,
  WorkspacesWorkspaceListItem,
  WorkspacesWorkspaceKindInfo,
  WorkspacesWorkspaceState,
} from '~/generated/data-contracts';
import {
  buildMockHealthCheckResponse,
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceCreate,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceList,
  buildMockWorkspaceUpdate,
  buildMockSecret,
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
export const mockWorkspace1: WorkspacesWorkspaceListItem = buildMockWorkspace({
  workspaceKind: mockWorkspaceKindInfo1,
  namespace: mockNamespace1.name,
});

export const mockWorkspace2: WorkspacesWorkspaceListItem = buildMockWorkspace({
  name: 'My Second Jupyter Notebook',
  workspaceKind: mockWorkspaceKindInfo1,
  namespace: mockNamespace2.name,
  state: WorkspacesWorkspaceState.WorkspaceStatePaused,
  paused: false,
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
          id: 'jupyterlab_scipy_180',
          displayName: 'jupyter-scipy:v1.8.0',
          description: 'JupyterLab, with SciPy Packages',
          labels: [
            { key: 'pythonVersion', value: '3.11' },
            { key: 'jupyterlabVersion', value: '1.8.0' },
          ],
        },
        redirectChain: [
          {
            source: {
              id: 'jupyterlab_scipy_180',
              displayName: 'jupyter-scipy:v1.8.0',
              description: 'JupyterLab, with SciPy Packages',
              labels: [
                { key: 'pythonVersion', value: '3.11' },
                { key: 'jupyterlabVersion', value: '1.8.0' },
              ],
            },
            target: {
              id: 'jupyterlab_scipy_190',
              displayName: 'jupyter-scipy:v1.9.0',
              description: 'JupyterLab, with SciPy Packages',
              labels: [
                { key: 'pythonVersion', value: '3.12' },
                { key: 'jupyterlabVersion', value: '1.9.0' },
              ],
            },
            message: {
              level: WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger,
              text: 'Your admin has upgraded the image from jupyter-scipy:v1.8.0 to jupyter-scipy:v1.9.0',
            },
          },
          {
            source: {
              id: 'jupyterlab_scipy_190',
              displayName: 'jupyter-scipy:v1.9.0',
              description: 'JupyterLab, with SciPy Packages',
              labels: [
                { key: 'pythonVersion', value: '3.12' },
                { key: 'jupyterlabVersion', value: '1.9.0' },
              ],
            },
            target: {
              id: 'jupyterlab_scipy_200',
              displayName: 'jupyter-scipy:v2.0.0',
              description: 'JupyterLab, with SciPy Packages',
              labels: [
                { key: 'pythonVersion', value: '3.12' },
                { key: 'jupyterlabVersion', value: '2.0.0' },
              ],
            },
            message: {
              level: WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning,
              text: 'Your admin has upgraded the image from jupyter-scipy:v1.9.0 to jupyter-scipy:v2.0.0',
            },
          },
          {
            source: {
              id: 'jupyterlab_scipy_200',
              displayName: 'jupyter-scipy:v2.0.0',
              description: 'JupyterLab, with SciPy Packages',
              labels: [
                { key: 'pythonVersion', value: '3.12' },
                { key: 'jupyterlabVersion', value: '2.0.0' },
              ],
            },
            target: {
              id: 'jupyterlab_scipy_210',
              displayName: 'jupyter-scipy:v2.1.0',
              description: 'JupyterLab, with SciPy Packages',
              labels: [
                { key: 'pythonVersion', value: '3.13' },
                { key: 'jupyterlabVersion', value: '2.1.0' },
              ],
            },
            message: {
              level: WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo,
              text: 'Your admin has upgraded the image from jupyter-scipy:v2.0.0 to jupyter-scipy:v2.1.0',
            },
          },
        ],
      },
      podConfig: {
        current: {
          id: 'small_cpu',
          displayName: 'Small CPU',
          description: 'Pod with 0.5 CPU, 512 Mb RAM',
          labels: [
            { key: 'cpu', value: '500m' },
            { key: 'memory', value: '512Mi' },
          ],
        },
        redirectChain: [
          {
            source: {
              id: 'small_cpu',
              displayName: 'Small CPU',
              description: 'Pod with 0.5 CPU, 512 Mb RAM',
              labels: [
                { key: 'cpu', value: '500m' },
                { key: 'memory', value: '512Mi' },
              ],
            },
            target: {
              id: 'medium_cpu',
              displayName: 'Medium CPU',
              description: 'Pod with 1 CPU, 1 Gb RAM',
              labels: [
                { key: 'cpu', value: '1000m' },
                { key: 'memory', value: '1Gi' },
              ],
            },
            message: {
              level: WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning,
              text: 'Your admin has upgraded the pod configuration from Small CPU to Medium CPU',
            },
          },
          {
            source: {
              id: 'medium_cpu',
              displayName: 'Medium CPU',
              description: 'Pod with 1 CPU, 1 Gb RAM',
              labels: [
                { key: 'cpu', value: '1000m' },
                { key: 'memory', value: '1Gi' },
              ],
            },
            target: {
              id: 'large_cpu',
              displayName: 'Large CPU',
              description: 'Pod with 4 CPU, 4 Gb RAM',
              labels: [
                { key: 'cpu', value: '4000m' },
                { key: 'memory', value: '4Gi' },
              ],
            },
            message: {
              level: WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning,
              text: 'Your admin has upgraded the pod configuration from Medium CPU to Large CPU',
            },
          },
        ],
      },
    },
  },
});

export const mockWorkspace3: WorkspacesWorkspaceListItem = buildMockWorkspace({
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

export const mockWorkspace4: WorkspacesWorkspaceListItem = buildMockWorkspace({
  name: 'My Fourth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: WorkspacesWorkspaceState.WorkspaceStateError,
  workspaceKind: mockWorkspaceKindInfo2,
});

export const mockWorkspace5: WorkspacesWorkspaceListItem = buildMockWorkspace({
  name: 'My Fifth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: WorkspacesWorkspaceState.WorkspaceStateTerminating,
  workspaceKind: mockWorkspaceKindInfo2,
});

const buildMockSecretList = (startIndex: number, count: number) => {
  const secrets = [];
  for (let i = startIndex; i <= startIndex + count; i++) {
    secrets.push(buildMockSecret({ name: `secret-${i}` }));
  }
  return secrets;
};

const buildMockSecretMountList = (startIndex: number, count: number) => {
  const mounts = [];
  for (let i = startIndex; i <= startIndex + count; i++) {
    mounts.push({
      name: `workspace-${i}`,
      group: `group-${i}`,
      kind: `kind-${i}`,
    });
  }
  return mounts;
};

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

export const mockWorkspaceCreate = buildMockWorkspaceCreate({});

export const mockWorkspaceUpdate = buildMockWorkspaceUpdate({});
export const mockSecretCreate: SecretsSecretCreate = {
  name: 'secret-1',
  type: 'Opaque',
  immutable: false,
  contents: {
    username: {
      base64: 'abcd',
    },
    password: {},
  },
};

export const mockSecretCreate3: SecretsSecretCreate = {
  name: 'secret-3',
  type: 'Opaque',
  immutable: false,
  contents: {
    apiKey: {},
    apiSecret: {},
  },
};

export const mockSecretsList = [
  buildMockSecret({
    name: 'secret-1',
    immutable: true,
    mounts: buildMockSecretMountList(1, 5),
  }),
  buildMockSecret({
    name: 'secret-2',
    canMount: false,
    mounts: buildMockSecretMountList(1, 2),
  }),
  buildMockSecret({
    name: 'secret-3',
    mounts: buildMockSecretMountList(1, 20),
  }),
  ...buildMockSecretList(4, 20),
];
