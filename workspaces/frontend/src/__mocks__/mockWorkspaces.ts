import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

export const mockWorkspaces = [
  buildMockWorkspace(),
  buildMockWorkspace({
    name: 'My Other Jupyter Notebook',
    options: {
      imageConfig: 'jupyterlab_scipy_180',
      podConfig: 'Large CPU',
    },
  }),
];
