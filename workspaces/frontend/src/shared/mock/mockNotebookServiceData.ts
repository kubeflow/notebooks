import {
  PvcsPVCCreate,
  SecretsSecretCreate,
  V1Beta1WorkspaceState,
  V1PersistentVolumeAccessMode,
  V1PersistentVolumeMode,
  V1PersistentVolumeReclaimPolicy,
  V1PodPhase,
  WorkspacekindsWorkspaceKind,
  WorkspacesRedirectMessageLevel,
  WorkspacesWorkspaceListItem,
  WorkspacesWorkspaceKindInfo,
} from '~/generated/data-contracts';
import {
  buildMockHealthCheckResponse,
  buildMockNamespace,
  buildMockPVC,
  buildMockPVCCreate,
  buildMockSecret,
  buildMockStorageClass,
  buildMockWorkspace,
  buildMockWorkspaceCreate,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceList,
  buildMockWorkspaceUpdate,
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
  state: V1Beta1WorkspaceState.WorkspaceStatePaused,
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
  state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  pendingRestart: true,
  activity: {
    lastActivity: new Date(2025, 2, 15).getTime(),
    lastUpdate: new Date(2025, 2, 1).getTime(),
  },
});

export const mockWorkspace4: WorkspacesWorkspaceListItem = buildMockWorkspace({
  name: 'My Fourth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: V1Beta1WorkspaceState.WorkspaceStateError,
  workspaceKind: mockWorkspaceKindInfo2,
});

export const mockWorkspace5: WorkspacesWorkspaceListItem = buildMockWorkspace({
  name: 'My Fifth Jupyter Notebook',
  namespace: mockNamespace2.name,
  state: V1Beta1WorkspaceState.WorkspaceStateTerminating,
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

// Storage Classes
export const mockStorageClassStandard = buildMockStorageClass({
  name: 'standard',
  displayName: 'Standard',
  description: 'Default storage class backed by standard HDDs',
  canUse: true,
});

export const mockStorageClassSSD = buildMockStorageClass({
  name: 'ssd',
  displayName: 'SSD',
  description: 'High-performance storage class backed by SSDs',
  canUse: true,
});

export const mockStorageClassRestricted = buildMockStorageClass({
  name: 'restricted',
  displayName: 'Restricted',
  description: 'Restricted storage class (no permissions)',
  canUse: false,
});

export const mockStorageClassesList = [
  mockStorageClassStandard,
  mockStorageClassSSD,
  mockStorageClassRestricted,
];

// PVCs
const toStorageClassInfo = ({
  name,
  displayName,
  description,
}: {
  name: string;
  displayName: string;
  description: string;
}) => ({
  name,
  displayName,
  description,
});

const STORAGE_CLASS_INFO = {
  standard: toStorageClassInfo(mockStorageClassStandard),
  ssd: toStorageClassInfo(mockStorageClassSSD),
};

const buildPersistentVolume = (
  name: string,
  mode: V1PersistentVolumeAccessMode,
  storageClass: 'standard' | 'ssd',
  reclaimPolicy: V1PersistentVolumeReclaimPolicy = V1PersistentVolumeReclaimPolicy.PersistentVolumeReclaimRetain,
) => ({
  name,
  accessModes: [mode],
  persistentVolumeReclaimPolicy: reclaimPolicy,
  volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
  storageClass: STORAGE_CLASS_INFO[storageClass],
});

const buildPVCSpecConfig = (
  mode: V1PersistentVolumeAccessMode,
  storage: string,
  storageClassName: string,
) => ({
  accessModes: [mode],
  requests: { storage },
  storageClassName,
  volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
});

const WORKSPACE_STATES: V1Beta1WorkspaceState[] = [
  V1Beta1WorkspaceState.WorkspaceStateRunning,
  V1Beta1WorkspaceState.WorkspaceStatePaused,
  V1Beta1WorkspaceState.WorkspaceStatePending,
  V1Beta1WorkspaceState.WorkspaceStateError,
];
const POD_PHASES: V1PodPhase[] = [
  V1PodPhase.PodRunning,
  V1PodPhase.PodPending,
  V1PodPhase.PodSucceeded,
  V1PodPhase.PodFailed,
];

// Builds coherently linked workspace and pod lists where each running workspace
// references its pod, and pods reference the node they run on.
const buildLinkedWorkspacesAndPods = (prefix: string, count: number, nodeName: string) => {
  const workspaces = Array.from({ length: count }, (_, i) => {
    const state = WORKSPACE_STATES[i % 4];
    const isRunning = state === V1Beta1WorkspaceState.WorkspaceStateRunning;
    return {
      name: `${prefix}-ws-${i + 1}`,
      state,
      stateMessage:
        state === V1Beta1WorkspaceState.WorkspaceStateError ? 'Something went wrong' : '',
      ...(isRunning ? { podTemplatePod: { name: `${prefix}-ws-${i + 1}-pod` } } : {}),
    };
  });

  const pods = workspaces
    .filter((ws) => ws.podTemplatePod)
    .map((ws, i) => ({
      name: ws.podTemplatePod!.name,
      phase: POD_PHASES[i % 4],
      node: { name: nodeName },
    }));

  return { workspaces, pods };
};

const ACCESS_MODES: V1PersistentVolumeAccessMode[] = [
  V1PersistentVolumeAccessMode.ReadWriteOnce,
  V1PersistentVolumeAccessMode.ReadOnlyMany,
  V1PersistentVolumeAccessMode.ReadWriteMany,
  V1PersistentVolumeAccessMode.ReadWriteOncePod,
];
const STORAGE_CLASSES: ('standard' | 'ssd')[] = ['standard', 'ssd'];

// Derives canMount based on Kubernetes access mode semantics:
// - ReadWriteOnce (RWO): unmountable if workspaces is non-empty (single-node)
// - ReadWriteOncePod (RWOP): unmountable if pods is non-empty (single-pod)
// - ReadOnlyMany (ROX) / ReadWriteMany (RWX): always mountable (multi-node)
const deriveCanMount = (
  mode: V1PersistentVolumeAccessMode,
  workspaces: unknown[],
  pods: unknown[],
): boolean => {
  switch (mode) {
    case V1PersistentVolumeAccessMode.ReadWriteOnce:
      return workspaces.length === 0;
    case V1PersistentVolumeAccessMode.ReadWriteOncePod:
      return pods.length === 0;
    default:
      return true;
  }
};

const buildPVCList = (count: number, startIndex = 1) =>
  Array.from({ length: count }, (_, i) => {
    const idx = startIndex + i;
    const mode = ACCESS_MODES[idx % 4];
    const sc = STORAGE_CLASSES[idx % 2];
    const nodeName = `node-${(idx % 3) + 1}`;

    // RWO/RWOP: single workspace + single pod on same node
    // ROX/RWX: multiple workspaces + pods across nodes
    const wsCount = mode === 'ReadWriteOnce' || mode === 'ReadWriteOncePod' ? 1 : (idx % 5) + 2;
    const { workspaces, pods } = buildLinkedWorkspacesAndPods(`pvc-${idx}`, wsCount, nodeName);

    return {
      name: `pvc-${idx}`,
      canMount: deriveCanMount(mode, workspaces, pods),
      canUpdate: idx % 3 === 0,
      pvcSpec: buildPVCSpecConfig(mode, `${(idx + 1) * 10}Gi`, sc),
      pv: buildPersistentVolume(`pv-${idx}`, mode, sc),
      workspaces,
      pods,
    };
  });

export const mockPVCsList = [
  buildMockPVC({
    name: 'pvc-rwo',
    canMount: false, // RWO with workspaces → unmountable
    pvcSpec: buildPVCSpecConfig(V1PersistentVolumeAccessMode.ReadWriteOnce, '10Gi', 'standard'),
    workspaces: [
      {
        name: 'workspace-1',
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        stateMessage: '',
        podTemplatePod: { name: 'workspace-1-pod' },
      },
    ],
    pods: [
      {
        name: 'workspace-1-pod',
        phase: V1PodPhase.PodRunning,
        node: { name: 'node-1' },
      },
    ],
  }),
  buildMockPVC({
    name: 'pvc-rox',
    canMount: true, // ROX → always mountable
    canUpdate: false,
    pvcSpec: buildPVCSpecConfig(V1PersistentVolumeAccessMode.ReadOnlyMany, '100Gi', 'standard'),
    pv: buildPersistentVolume('pv-rox', V1PersistentVolumeAccessMode.ReadOnlyMany, 'standard'),
    ...buildLinkedWorkspacesAndPods('pvc-rox', 3, 'node-1'),
  }),
  buildMockPVC({
    name: 'pvc-rwx',
    canMount: true, // RWX → always mountable
    canUpdate: false,
    pvcSpec: buildPVCSpecConfig(V1PersistentVolumeAccessMode.ReadWriteMany, '50Gi', 'ssd'),
    pv: buildPersistentVolume('pv-rwx', V1PersistentVolumeAccessMode.ReadWriteMany, 'ssd'),
    ...buildLinkedWorkspacesAndPods('pvc-rwx', 20, 'node-2'),
  }),
  buildMockPVC({
    name: 'pvc-rwop',
    canMount: true,
    pvcSpec: buildPVCSpecConfig(V1PersistentVolumeAccessMode.ReadWriteOncePod, '20Gi', 'ssd'),
    pv: buildPersistentVolume(
      'pv-rwop',
      V1PersistentVolumeAccessMode.ReadWriteOncePod,
      'ssd',
      V1PersistentVolumeReclaimPolicy.PersistentVolumeReclaimDelete,
    ),
    workspaces: [],
    pods: [],
  }),
  buildMockPVC({
    name: 'pvc-restricted',
    canMount: false, // restricted storage class, no permissions
    canUpdate: false,
    pvcSpec: buildPVCSpecConfig(V1PersistentVolumeAccessMode.ReadWriteOnce, '5Gi', 'restricted'),
    workspaces: [],
    pods: [],
  }),
  ...buildPVCList(10).map(buildMockPVC),
];

export const mockPVCCreate: PvcsPVCCreate = buildMockPVCCreate({
  name: 'new-pvc',
  accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
  requests: { storage: '10Gi' },
  storageClassName: 'standard',
});
