import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import useWorkspaceFormData, { EMPTY_FORM_DATA } from '~/app/hooks/useWorkspaceFormData';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceUpdateFromWorkspace,
} from '~/shared/mock/mockBuilder';

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
      useWorkspaceFormData({
        namespace: undefined,
        workspaceName: undefined,
        workspaceKindName: undefined,
      }),
    );
    await waitForNextUpdate();

    const workspaceFormData = result.current[0];
    expect(workspaceFormData).toEqual(EMPTY_FORM_DATA);
  });

  it('maps workspace and kind into form data when API available', async () => {
    const mockWorkspace = buildMockWorkspace({});
    const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({ workspace: mockWorkspace });
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const getWorkspace = jest.fn().mockResolvedValue({
      ok: true,
      data: mockWorkspaceUpdate,
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
      useWorkspaceFormData({
        namespace: 'ns',
        workspaceName: 'My First Jupyter Notebook',
        workspaceKindName: 'wk',
      }),
    );
    await waitForNextUpdate();

    const workspaceFormData = result.current[0];
    expect(workspaceFormData).toEqual({
      kind: mockWorkspaceKind,
      imageConfig: mockWorkspace.podTemplate.options.imageConfig.current.id,
      podConfig: mockWorkspace.podTemplate.options.podConfig.current.id,
      properties: {
        workspaceName: mockWorkspace.name,
        volumes: mockWorkspace.podTemplate.volumes.data,
        secrets: mockWorkspace.podTemplate.volumes.secrets,
        homeDirectory: mockWorkspace.podTemplate.volumes.home?.mountPath,
      },
      revision: mockWorkspaceUpdate.revision,
    });
  });
});
