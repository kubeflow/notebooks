import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

export const mockWorkspaces = [
  buildMockWorkspace(),
  buildMockWorkspace({
    name: 'My Second Jupyter Notebook',
    podTemplate: {
      podMetadata: {
        labels: {},
        annotations: {},
      },
      volumes: {
        home: {
          pvcName: 'workspace-home-pvc',
          mountPath: '/home',
          readOnly: false,
        },
        data: [
          {
            pvcName: 'workspace-data-pvc',
            mountPath: '/data',
            readOnly: false,
          },
        ],
      },
      options: {
        imageConfig: {
          current: {
            id: 'jupyterlab_scipy_180',
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
            description: 'Pod with 1 CPU, 16 Gb RAM',
            labels: [
              { key: 'cpu', value: '4000m' },
              { key: 'memory', value: '16Gi' },
              { key: 'gpu', value: '1' },
            ],
          },
        },
      },
    },
  }),
];
