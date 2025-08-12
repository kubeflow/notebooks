import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaceKindByName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when API not available', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useWorkspaceKindByName('jupyter'));
    await waitForNextUpdate();

    const [workspaceKind, loaded, error] = result.current;
    expect(workspaceKind).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeDefined();
  });

  it('returns null when no kind provided', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useWorkspaceKindByName(undefined));
    await waitForNextUpdate();

    const [workspaceKind, loaded, error] = result.current;
    expect(workspaceKind).toBeNull();
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('returns kind when API is available', async () => {
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const getWorkspaceKind = jest.fn().mockResolvedValue({ ok: true, data: mockWorkspaceKind });
    mockUseNotebookAPI.mockReturnValue({
      api: { workspaceKinds: { getWorkspaceKind } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceKindByName(mockWorkspaceKind.name),
    );
    await waitForNextUpdate();

    const [workspaceKind, loaded, error] = result.current;
    expect(workspaceKind).toEqual(mockWorkspaceKind);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });
});
