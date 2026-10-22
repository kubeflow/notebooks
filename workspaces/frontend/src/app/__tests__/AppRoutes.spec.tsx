import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import AppRoutes from '~/app/AppRoutes';
import { useAppContext } from '~/app/context/AppContext';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceKindForm } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';
import { Workspacekinds } from '~/generated/Workspacekinds';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildAxiosError } from '~/shared/mock/mockUtils';
import { DEV_AUTH_USER_KEY, registerDevAuthInterceptor } from '~/shared/utilities/devAuth';

jest.mock('~/app/context/AppContext', () => ({
  useAppContext: jest.fn(),
}));
jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));
jest.mock('~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm', () => ({
  WorkspaceKindForm: jest.fn(() => <div data-testid="workspace-kind-form" />),
}));
jest.mock('~/app/pages/WorkspaceKinds/WorkspaceKinds', () => ({
  WorkspaceKinds: () => null,
}));
jest.mock('~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummaryWrapper', () => ({
  WorkspaceKindSummaryWrapper: () => null,
}));
jest.mock('~/app/pages/Workspaces/WorkspacesWrapper', () => ({
  WorkspacesWrapper: () => null,
}));
jest.mock('~/app/pages/Workspaces/Form/WorkspaceForm', () => ({
  WorkspaceForm: () => null,
}));
jest.mock('~/app/pages/Debug/Debug', () => ({
  Debug: () => null,
}));
jest.mock('~/app/pages/notFound/NotFound', () => ({
  NotFound: () => null,
}));

const mockUseAppContext = jest.mocked(useAppContext);
const mockUseNotebookAPI = jest.mocked(useNotebookAPI);
const mockWorkspaceKindForm = jest.mocked(WorkspaceKindForm);

const mockWorkspaceKindsApi = (workspaceKinds: object) =>
  mockUseNotebookAPI.mockReturnValue({
    api: { workspaceKinds } as unknown as NotebookApis,
    apiAvailable: true,
    refreshAllAPI: jest.fn(),
  });

const forbiddenError = () =>
  buildAxiosError({ error: { code: 'forbidden', message: 'Forbidden' } }, 403);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const expectRestrictedAccess = () => {
  expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
  expect(
    screen.getByText('WorkspaceKind management is restricted to administrators'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Please contact your admin if you need changes to workspace configurations.'),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('workspace-kind-form')).not.toBeInTheDocument();
  expect(mockWorkspaceKindForm).not.toHaveBeenCalled();
};

const expectLoadError = async () => {
  expect(await screen.findByText('Failed to load workspace kinds')).toBeInTheDocument();
  expect(screen.queryByTestId('workspace-kinds-access-empty-state')).not.toBeInTheDocument();
  expect(screen.queryByTestId('workspace-kind-form')).not.toBeInTheDocument();
  expect(mockWorkspaceKindForm).not.toHaveBeenCalled();
};

describe('AppRoutes WorkspaceKind admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Matches AppContextProvider, which hardcodes clusterAdmin: true.
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'kubeflow-user', clusterAdmin: true },
    });
  });

  describe.each([
    ['create', '/workspacekinds/create'],
    ['edit', '/workspacekinds/jupyterlab/edit'],
  ])('%s route', (_, path) => {
    it('renders the WorkspaceKind form when the workspace kinds request succeeds', async () => {
      const listWorkspaceKinds = jest.fn().mockResolvedValue({ data: [] });
      mockWorkspaceKindsApi({ listWorkspaceKinds });

      renderAt(path);

      expect(await screen.findByTestId('workspace-kind-form')).toBeInTheDocument();
      expect(screen.queryByTestId('workspace-kinds-access-empty-state')).not.toBeInTheDocument();
      expect(listWorkspaceKinds).toHaveBeenCalledTimes(1);
      expect(listWorkspaceKinds).toHaveBeenCalledWith(undefined);
    });

    it('shows the restricted-access message on 403 even though clusterAdmin is true', async () => {
      mockWorkspaceKindsApi({ listWorkspaceKinds: jest.fn().mockRejectedValue(forbiddenError()) });

      renderAt(path);

      await screen.findByTestId('workspace-kinds-access-empty-state');
      expectRestrictedAccess();
      expect(screen.queryByText('Failed to load workspace kinds')).not.toBeInTheDocument();
    });

    it('shows a spinner without mounting the form while the request is pending', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockWorkspaceKindsApi({ listWorkspaceKinds: jest.fn(() => new Promise<void>(() => {})) });

      renderAt(path);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByTestId('workspace-kinds-access-empty-state')).not.toBeInTheDocument();
      expect(mockWorkspaceKindForm).not.toHaveBeenCalled();
    });

    it.each([
      [401, 'unauthorized'],
      [500, 'internal_server_error'],
    ])('shows the load error instead of the restricted view on %i', async (status, code) => {
      mockWorkspaceKindsApi({
        listWorkspaceKinds: jest
          .fn()
          .mockRejectedValue(
            buildAxiosError({ error: { code, message: 'Request failed' } }, status),
          ),
      });

      renderAt(path);

      await expectLoadError();
    });

    it('shows the load error instead of the restricted view on a network error', async () => {
      mockWorkspaceKindsApi({
        listWorkspaceKinds: jest
          .fn()
          .mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK)),
      });

      renderAt(path);

      await expectLoadError();
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });

  it('checks access again when the route remounts', async () => {
    const listWorkspaceKinds = jest
      .fn()
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(forbiddenError());
    mockWorkspaceKindsApi({ listWorkspaceKinds });

    const { unmount } = renderAt('/workspacekinds/create');
    expect(await screen.findByTestId('workspace-kind-form')).toBeInTheDocument();
    unmount();
    mockWorkspaceKindForm.mockClear();

    renderAt('/workspacekinds/create');

    await screen.findByTestId('workspace-kinds-access-empty-state');
    expectRestrictedAccess();
    expect(listWorkspaceKinds).toHaveBeenCalledTimes(2);
  });

  describe('with the real WorkspaceKinds client and dev auth interceptor', () => {
    // Stands in for the backend: like the Tilt RBAC, only `admin` may list WorkspaceKinds.
    const backendAdapter = jest.fn(
      async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
        const response: AxiosResponse = {
          data: { data: [] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
        if (config.headers.get('kubeflow-userid') === 'admin') {
          return response;
        }
        throw new AxiosError(
          'Request failed with status code 403',
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          {
            ...response,
            data: { error: { code: 'forbidden', message: 'Forbidden' } },
            status: 403,
            statusText: 'Forbidden',
          },
        );
      },
    );

    beforeEach(() => {
      const workspaceKinds = new Workspacekinds({ baseURL: '/api/v1', adapter: backendAdapter });
      registerDevAuthInterceptor(workspaceKinds.instance);
      mockWorkspaceKindsApi(workspaceKinds);
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('re-checks access with the current dev identity after switching users', async () => {
      localStorage.setItem(DEV_AUTH_USER_KEY, 'admin');
      const { unmount } = renderAt('/workspacekinds/jupyterlab/edit');
      expect(await screen.findByTestId('workspace-kind-form')).toBeInTheDocument();
      unmount();
      mockWorkspaceKindForm.mockClear();

      localStorage.setItem(DEV_AUTH_USER_KEY, 'user');
      renderAt('/workspacekinds/jupyterlab/edit');

      await screen.findByTestId('workspace-kinds-access-empty-state');
      expectRestrictedAccess();
      expect(
        backendAdapter.mock.calls.map(([config]) => ({
          url: config.url,
          params: config.params,
          userId: config.headers.get('kubeflow-userid'),
        })),
      ).toEqual([
        { url: '/workspacekinds', params: undefined, userId: 'admin' },
        { url: '/workspacekinds', params: undefined, userId: 'user' },
      ]);
    });
  });
});
