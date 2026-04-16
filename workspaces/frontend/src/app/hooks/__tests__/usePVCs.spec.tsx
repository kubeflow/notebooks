import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import usePVCs from '~/app/hooks/usePVCs';
import { NotebookApis } from '~/shared/api/notebookApi';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));
jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;
const mockUseNamespaceSelectorWrapper = useNamespaceSelectorWrapper as jest.MockedFunction<
  typeof useNamespaceSelectorWrapper
>;

describe('usePVCs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNamespaceSelectorWrapper.mockReturnValue({
      selectedNamespace: 'test-namespace',
      namespacesLoaded: true,
    } as ReturnType<typeof useNamespaceSelectorWrapper>);
  });

  it('returns empty list and no error when API is not yet available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => usePVCs());

    expect(result.current.pvcs).toEqual([]);
    expect(result.current.pvcsLoaded).toBe(false);
    expect(result.current.pvcLoadError).toBeNull();
  });

  it('returns empty list and no error when namespace is not yet available', () => {
    mockUseNamespaceSelectorWrapper.mockReturnValue({
      selectedNamespace: '',
      namespacesLoaded: false,
    } as ReturnType<typeof useNamespaceSelectorWrapper>);

    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => usePVCs());

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

    const { result, waitForNextUpdate } = renderHook(() => usePVCs());
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

    const { result, waitForNextUpdate } = renderHook(() => usePVCs());
    await waitForNextUpdate();

    expect(result.current.pvcs).toEqual([]);
    expect(result.current.pvcsLoaded).toBe(false);
    expect(result.current.pvcLoadError).toBe(
      'Failed to load volume details. Connection info may be unavailable.',
    );
  });
});
