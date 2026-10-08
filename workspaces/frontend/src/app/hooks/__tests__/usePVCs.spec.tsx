import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import usePVCs from '~/app/hooks/usePVCs';
import { NotebookApis } from '~/shared/api/notebookApi';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('usePVCs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty list and no error when API is not yet available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => usePVCs('test-namespace'));

    expect(result.current.pvcs).toEqual([]);
    expect(result.current.pvcsLoaded).toBe(false);
    expect(result.current.pvcLoadError).toBeNull();
  });

  it('returns empty list and no error when namespace is not yet available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => usePVCs(''));

    expect(result.current.pvcs).toEqual([]);
    expect(result.current.pvcsLoaded).toBe(false);
    expect(result.current.pvcLoadError).toBeNull();
  });

  it('returns PVCs and no error when fetch succeeds', async () => {
    const mockPVCs = [
      { name: 'data-pvc', canMount: true, pods: [], workspaces: [] },
      { name: 'shared-pvc', canMount: true, pods: [], workspaces: [] },
    ];
    const listPvCs = jest.fn().mockResolvedValue({ data: mockPVCs });

    mockUseNotebookAPI.mockReturnValue({
      api: { pvc: { listPvCs } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => usePVCs('test-namespace'));
    await waitForNextUpdate();

    expect(listPvCs).toHaveBeenCalledWith('test-namespace');
    expect(result.current.pvcs).toEqual(mockPVCs);
    expect(result.current.pvcsLoaded).toBe(true);
    expect(result.current.pvcLoadError).toBeNull();
  });

  it('returns empty list and user-facing error message when fetch fails', async () => {
    const listPvCs = jest.fn().mockRejectedValue(new Error('network error'));

    mockUseNotebookAPI.mockReturnValue({
      api: { pvc: { listPvCs } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => usePVCs('test-namespace'));
    await waitForNextUpdate();

    expect(result.current.pvcs).toEqual([]);
    expect(result.current.pvcsLoaded).toBe(false);
    expect(result.current.pvcLoadError).toBe(
      'Failed to load volume details. Connection info may be unavailable.',
    );
  });

  it('re-fetches when the namespace prop changes, independent of any global namespace selector', async () => {
    const listPvCs = jest.fn().mockResolvedValue({ data: [] });

    mockUseNotebookAPI.mockReturnValue({
      api: { pvc: { listPvCs } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { rerender, waitForNextUpdate } = renderHook(
      ({ namespace }: { namespace: string }) => usePVCs(namespace),
      { initialProps: { namespace: 'workspace-namespace' } },
    );
    await waitForNextUpdate();

    expect(listPvCs).toHaveBeenCalledWith('workspace-namespace');

    rerender({ namespace: 'other-namespace' });
    await waitForNextUpdate();

    expect(listPvCs).toHaveBeenCalledWith('other-namespace');
  });
});
