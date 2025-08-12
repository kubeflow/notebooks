import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaceKinds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when API not available', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useWorkspaceKinds());
    await waitForNextUpdate();

    const [workspaceKinds, loaded, error] = result.current;
    expect(workspaceKinds).toEqual([]);
    expect(loaded).toBe(false);
    expect(error).toBeDefined();
  });

  it('returns kinds when API is available', async () => {
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const listWorkspaceKinds = jest.fn().mockResolvedValue({ ok: true, data: [mockWorkspaceKind] });
    mockUseNotebookAPI.mockReturnValue({
      api: { workspaceKinds: { listWorkspaceKinds } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useWorkspaceKinds());
    await waitForNextUpdate();

    const [workspaceKinds, loaded, error] = result.current;
    expect(workspaceKinds).toEqual([mockWorkspaceKind]);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });
});
