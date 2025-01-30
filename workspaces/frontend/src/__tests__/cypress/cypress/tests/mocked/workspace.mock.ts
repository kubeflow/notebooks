import type { Workspace } from '~/shared/types';
import { WorkspaceState } from '~/shared/types';

const generateMockWorkspace = (
  name: string,
  namespace: string,
  state: WorkspaceState,
  paused: boolean,
  imageConfig: string,
  podConfig: string,
  pvcName: string,
): Workspace => {
  const currentTime = Date.now();
  const lastActivityTime = currentTime - Math.floor(Math.random() * 1000000); // Random last activity time
  const lastUpdateTime = currentTime - Math.floor(Math.random() * 100000); // Random last update time

  return {
    name,
    namespace,
    workspace_kind: {
      name: 'jupyterlab',
    },
    defer_updates: paused,
    paused,
    paused_time: paused ? currentTime - Math.floor(Math.random() * 1000000) : 0,
    state,
    state_message:
      state === WorkspaceState.Running
        ? 'Workspace is running smoothly.'
        : state === WorkspaceState.Paused
          ? 'Workspace is paused.'
          : 'Workspace is operational.',
    pod_template: {
      pod_metadata: {
        labels: {},
        annotations: {},
      },
      volumes: {
        home: {
          pvc_name: `${pvcName}-home`,
          mount_path: '/home/jovyan',
          readOnly: false,
        },
        data: [
          {
            pvc_name: pvcName,
            mount_path: '/data/my-data',
            readOnly: paused, // Set based on the paused state
          },
        ],
      },
      image_config: {
        current: imageConfig,
        desired: '',
        redirect_chain: [],
      },
      pod_config: {
        current: podConfig,
        desired: podConfig,
        redirect_chain: [],
      },
    },
    activity: {
      last_activity: lastActivityTime,
      last_update: lastUpdateTime,
      last_probe: {
        start_time_ms: lastUpdateTime - 1000, // Simulated probe timing
        end_time_ms: lastUpdateTime,
        result: 'default_result',
        message: 'default_message',
      },
    },
  };
};

const generateMockWorkspaces = (numWorkspaces: number, byNamespace = false) => {
  const mockWorkspaces = [];
  const podConfigs = ['Small CPU', 'Medium CPU', 'Large CPU'];
  const imageConfigs = [
    'jupyterlab_scipy_180',
    'jupyterlab_tensorflow_230',
    'jupyterlab_pytorch_120',
  ];
  const namespaces = byNamespace ? ['kubeflow'] : ['kubeflow', 'system', 'user-example', 'default'];

  for (let i = 1; i <= numWorkspaces; i++) {
    const state =
      i % 3 === 0
        ? WorkspaceState.Error
        : i % 2 === 0
          ? WorkspaceState.Paused
          : WorkspaceState.Running;
    const paused = state === WorkspaceState.Paused;
    const name = `workspace-${i}`;
    const namespace = namespaces[i % namespaces.length];
    const pvcName = `data-pvc-${i}`;
    const imageConfig = imageConfigs[i % imageConfigs.length];
    const podConfig = podConfigs[i % podConfigs.length];

    mockWorkspaces.push(
      generateMockWorkspace(name, namespace, state, paused, imageConfig, podConfig, pvcName),
    );
  }

  return mockWorkspaces;
};

// Example usage
export const mockWorkspaces = generateMockWorkspaces(5);
export const mockWorkspacesByNS = generateMockWorkspaces(10, true);
