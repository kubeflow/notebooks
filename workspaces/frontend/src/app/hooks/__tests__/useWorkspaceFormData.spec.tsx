import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import useWorkspaceFormData, { EMPTY_FORM_DATA } from '~/app/hooks/useWorkspaceFormData';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaceFormData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty form data when missing namespace or name', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceFormData({ namespace: undefined, workspaceName: undefined }),
    );
    await waitForNextUpdate();

    const workspaceFormData = result.current[0];
    expect(workspaceFormData).toEqual(EMPTY_FORM_DATA);
  });

  it('maps workspace and kind into form data when API available', async () => {
    const mockWorkspace = buildMockWorkspace({});
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const getWorkspace = jest.fn().mockResolvedValue({
      ok: true,
      data: mockWorkspace,
    });
    const getWorkspaceKind = jest.fn().mockResolvedValue({ ok: true, data: mockWorkspaceKind });

    const api = {
      workspaces: { getWorkspace },
      workspaceKinds: { getWorkspaceKind },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceFormData({ namespace: 'ns', workspaceName: 'ws' }),
    );
    await waitForNextUpdate();

    const workspaceFormData = result.current[0];
    expect(workspaceFormData).toEqual({
      kind: mockWorkspaceKind,
      image: {
        ...mockWorkspace.podTemplate.options.imageConfig.current,
        hidden: mockWorkspaceKind.hidden,
      },
      podConfig: {
        ...mockWorkspace.podTemplate.options.podConfig.current,
        hidden: mockWorkspaceKind.hidden,
      },
      properties: {
        workspaceName: mockWorkspace.name,
        deferUpdates: mockWorkspace.deferUpdates,
        volumes: mockWorkspace.podTemplate.volumes.data,
        secrets: mockWorkspace.podTemplate.volumes.secrets,
        homeDirectory: mockWorkspace.podTemplate.volumes.home?.mountPath,
      },
    });
  });
});
