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
        workspaceKinds: [],
        workspaceKindsLoaded: false,
        workspaceKindsError: undefined,
      }),
    );
    await waitForNextUpdate();

    const workspaceFormData = result.current[0];
    expect(workspaceFormData).toEqual(EMPTY_FORM_DATA);
  });

  it('returns error when workspace kinds fail to load', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const kindsError = new Error('Failed to fetch workspace kinds');

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceFormData({
        namespace: 'ns',
        workspaceName: 'my-workspace',
        workspaceKindName: 'jupyterlab',
        workspaceKinds: [],
        workspaceKindsLoaded: false,
        workspaceKindsError: kindsError,
      }),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toEqual(EMPTY_FORM_DATA);
    expect(loaded).toBe(false);
    expect(error).toBeDefined();
  });

  it('maps workspace and kind into form data when API available', async () => {
    const mockWorkspace = buildMockWorkspace({});
    const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({ workspace: mockWorkspace });
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const getWorkspace = jest.fn().mockResolvedValue({
      ok: true,
      data: mockWorkspaceUpdate,
    });

    const api = {
      workspaces: { getWorkspace },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceFormData({
        namespace: 'ns',
        workspaceName: 'my-first-jupyter-notebook',
        workspaceKindName: mockWorkspaceKind.name,
        workspaceKinds: [mockWorkspaceKind],
        workspaceKindsLoaded: true,
        workspaceKindsError: undefined,
      }),
    );
    await waitForNextUpdate();

    const workspaceFormData = result.current[0];
    const { podTemplate } = mockWorkspaceUpdate;
    const expectedHomeVolume = podTemplate.volumes.home
      ? {
          pvcName: podTemplate.volumes.home,
          mountPath: '',
          readOnly: false,
          isAttached: true,
        }
      : undefined;
    expect(workspaceFormData).toEqual({
      kind: mockWorkspaceKind,
      imageConfig: podTemplate.options.imageConfig,
      podConfig: podTemplate.options.podConfig,
      properties: {
        workspaceName: mockWorkspace.name,
        volumes: podTemplate.volumes.data.map((v) => ({
          ...v,
          isAttached: true,
        })),
        secrets: (podTemplate.volumes.secrets ?? []).map((s) => ({
          ...s,
          isAttached: true,
        })),
        homeVolume: expectedHomeVolume,
      },
      revision: mockWorkspaceUpdate.revision,
    });
  });
});
