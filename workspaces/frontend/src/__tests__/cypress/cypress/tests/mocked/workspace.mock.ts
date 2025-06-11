import { WorkspaceState } from '~/shared/api/backendApiTypes';
import type { Workspace, WorkspaceKindInfo } from '~/shared/api/backendApiTypes';

const generateMockWorkspace = (
  name: string,
  namespace: string,
  state: WorkspaceState,
  paused: boolean,
  imageConfigId: string,
  imageConfigDisplayName: string,
  podConfigId: string,
  podConfigDisplayName: string,
  pvcName: string,
): Workspace => {
  const pausedTime = new Date(2025, 0, 1).getTime();
  const lastActivityTime = new Date(2025, 0, 2).getTime();
  const lastUpdateTime = new Date(2025, 0, 3).getTime();

  return {
    name,
    namespace,
    workspaceKind: { name: 'jupyterlab' } as WorkspaceKindInfo,
    deferUpdates: paused,
    paused,
    pausedTime,
    pendingRestart: Math.random() < 0.5, //to generate randomly True/False value
    state,
    stateMessage:
      state === WorkspaceState.WorkspaceStateRunning
        ? 'Workspace is running smoothly.'
        : state === WorkspaceState.WorkspaceStatePaused
          ? 'Workspace is paused.'
          : 'Workspace is operational.',
    podTemplate: {
      podMetadata: {
        labels: {},
        annotations: {},
      },
      volumes: {
        home: {
          pvcName: `${pvcName}-home`,
          mountPath: '/home/jovyan',
          readOnly: false,
        },
        data: [
          {
            pvcName,
            mountPath: '/data/my-data',
            readOnly: paused,
          },
        ],
      },
      options: {
        imageConfig: {
          current: {
            id: imageConfigId,
            displayName: imageConfigDisplayName,
            description: 'JupyterLab environment',
            labels: [{ key: 'python_version', value: '3.11' }],
          },
        },
        podConfig: {
          current: {
            id: podConfigId,
            displayName: podConfigDisplayName,
            description: 'Pod configuration with resource limits',
            labels: [
              { key: 'cpu', value: '100m' },
              { key: 'memory', value: '128Mi' },
            ],
          },
        },
      },
    },
    activity: {
      lastActivity: lastActivityTime,
      lastUpdate: lastUpdateTime,
    },
    services: [
      {
        httpService: {
          displayName: 'Jupyter-lab',
          httpPath: `/workspace/${namespace}/${name}/Jupyter-lab/`,
        },
      },
    ],
  };
};

const generateMockWorkspaces = (numWorkspaces: number, byNamespace = false) => {
  const mockWorkspaces = [];
  const podConfigs = [
    { id: 'small-cpu', displayName: 'Small CPU' },
    { id: 'medium-cpu', displayName: 'Medium CPU' },
    { id: 'large-cpu', displayName: 'Large CPU' },
  ];
  const imageConfigs = [
    { id: 'jupyterlab_scipy_180', displayName: 'JupyterLab SciPy 1.8.0' },
    { id: 'jupyterlab_tensorflow_230', displayName: 'JupyterLab TensorFlow 2.3.0' },
    { id: 'jupyterlab_pytorch_120', displayName: 'JupyterLab PyTorch 1.2.0' },
  ];
  const namespaces = byNamespace ? ['kubeflow'] : ['kubeflow', 'system', 'user-example', 'default'];

  for (let i = 1; i <= numWorkspaces; i++) {
    const state =
      i % 3 === 0
        ? WorkspaceState.WorkspaceStateError
        : i % 2 === 0
          ? WorkspaceState.WorkspaceStatePaused
          : WorkspaceState.WorkspaceStateRunning;
    const paused = state === WorkspaceState.WorkspaceStatePaused;
    const name = `workspace-${i}`;
    const namespace = namespaces[i % namespaces.length];
    const pvcName = `data-pvc-${i}`;

    const imageConfig = imageConfigs[i % imageConfigs.length];
    const podConfig = podConfigs[i % podConfigs.length];

    mockWorkspaces.push(
      generateMockWorkspace(
        name,
        namespace,
        state,
        paused,
        imageConfig.id,
        imageConfig.displayName,
        podConfig.id,
        podConfig.displayName,
        pvcName,
      ),
    );
  }

  return mockWorkspaces;
};

// Example usage
export const mockWorkspaces = generateMockWorkspaces(5);
export const mockWorkspacesByNS = generateMockWorkspaces(10, true);
