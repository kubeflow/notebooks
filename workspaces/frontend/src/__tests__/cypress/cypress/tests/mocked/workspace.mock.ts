import type { Workspace } from '~/shared/types';
import { WorkspaceState } from '~/shared/types';

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
): {
  name: string;
  namespace: string;
  workspace_kind: { name: string };
  defer_updates: boolean;
  paused: boolean;
  paused_time: number;
  state: WorkspaceState;
  state_message: string;
  pod_template: {
    pod_metadata: { labels: {}; annotations: {} };
    volumes: {
      home: { pvc_name: string; mount_path: string; readOnly: boolean };
      data: { pvc_name: string; mount_path: string; readOnly: boolean }[];
    };
    options: {
      image_config: {
        current: {
          id: string;
          display_name: string;
          description: string;
          labels: { key: string; value: string }[];
        };
      };
      pod_config: {
        current: {
          id: string;
          display_name: string;
          description: string;
          labels: ({ key: string; value: string } | { key: string; value: string })[];
        };
      };
    };
    image_config: { current: string; desired: string; redirect_chain: any[] };
    pod_config: { current: string; desired: string; redirect_chain: any[] };
  };
  activity: { last_activity: number; last_update: number };
} => {
  const currentTime = Date.now();
  const lastActivityTime = currentTime - Math.floor(Math.random() * 1000000);
  const lastUpdateTime = currentTime - Math.floor(Math.random() * 100000);

  return {
    name,
    namespace,
    workspace_kind: { name: 'jupyterlab' },
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
            readOnly: paused,
          },
        ],
      },
      options: {
        image_config: {
          current: {
            id: imageConfigId,
            display_name: imageConfigDisplayName,
            description: 'JupyterLab environment',
            labels: [{ key: 'python_version', value: '3.11' }],
          },
        },
        pod_config: {
          current: {
            id: podConfigId,
            display_name: podConfigDisplayName,
            description: 'Pod configuration with resource limits',
            labels: [
              { key: 'cpu', value: '100m' },
              { key: 'memory', value: '128Mi' },
            ],
          },
        },
      },
      image_config: {
        current: imageConfigId,
        desired: '',
        redirect_chain: [],
      },
      pod_config: {
        current: podConfigId,
        desired: podConfigId,
        redirect_chain: [],
      },
    },
    activity: {
      last_activity: lastActivityTime,
      last_update: lastUpdateTime,
    },
  };
};

const generateMockWorkspaces = (numWorkspaces: number, byNamespace = false) => {
  const mockWorkspaces = [];
  const podConfigs = [
    { id: 'small-cpu', display_name: 'Small CPU' },
    { id: 'medium-cpu', display_name: 'Medium CPU' },
    { id: 'large-cpu', display_name: 'Large CPU' },
  ];
  const imageConfigs = [
    { id: 'jupyterlab_scipy_180', display_name: 'JupyterLab SciPy 1.8.0' },
    { id: 'jupyterlab_tensorflow_230', display_name: 'JupyterLab TensorFlow 2.3.0' },
    { id: 'jupyterlab_pytorch_120', display_name: 'JupyterLab PyTorch 1.2.0' },
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
      generateMockWorkspace(
        name,
        namespace,
        state,
        paused,
        imageConfig.id,
        imageConfig.display_name,
        podConfig.id,
        podConfig.display_name,
        pvcName,
      ),
    );
  }

  return mockWorkspaces;
};

// Example usage
export const mockWorkspaces = generateMockWorkspaces(5);
export const mockWorkspacesByNS = generateMockWorkspaces(10, true);
