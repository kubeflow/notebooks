import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useSecrets from '~/app/hooks/useSecrets';
import { NotebookApis } from '~/shared/api/notebookApi';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useSecrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty list and no error when API is not yet available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useSecrets('test-namespace'));

    expect(result.current.secrets).toEqual([]);
    expect(result.current.secretsLoaded).toBe(false);
    expect(result.current.secretLoadError).toBeNull();
  });

  it('returns empty list and no error when namespace is not yet available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useSecrets(''));

    expect(result.current.secrets).toEqual([]);
    expect(result.current.secretsLoaded).toBe(false);
    expect(result.current.secretLoadError).toBeNull();
  });

  it('returns secrets and no error when fetch succeeds', async () => {
    const mockSecrets = [
      { name: 'api-key', type: 'Opaque', immutable: false, canMount: true, canUpdate: true },
      { name: 'db-credentials', type: 'Opaque', immutable: true, canMount: true, canUpdate: false },
    ];
    const listSecrets = jest.fn().mockResolvedValue({ data: mockSecrets });

    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { listSecrets } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useSecrets('test-namespace'));
    await waitForNextUpdate();

    expect(listSecrets).toHaveBeenCalledWith('test-namespace');
    expect(result.current.secrets).toEqual(mockSecrets);
    expect(result.current.secretsLoaded).toBe(true);
    expect(result.current.secretLoadError).toBeNull();
  });

  it('returns empty list and user-facing error message when fetch fails', async () => {
    const listSecrets = jest.fn().mockRejectedValue(new Error('network error'));

    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { listSecrets } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useSecrets('test-namespace'));
    await waitForNextUpdate();

    expect(result.current.secrets).toEqual([]);
    expect(result.current.secretsLoaded).toBe(false);
    expect(result.current.secretLoadError).toBe('Failed to load secret details.');
  });

  it('exposes a refreshSecrets function', async () => {
    const listSecrets = jest.fn().mockResolvedValue({ data: [] });

    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { listSecrets } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useSecrets('test-namespace'));
    await waitForNextUpdate();

    expect(typeof result.current.refreshSecrets).toBe('function');
  });

  it('re-fetches when the namespace prop changes, independent of any global namespace selector', async () => {
    const listSecrets = jest.fn().mockResolvedValue({ data: [] });

    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { listSecrets } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { rerender, waitForNextUpdate } = renderHook(
      ({ namespace }: { namespace: string }) => useSecrets(namespace),
      { initialProps: { namespace: 'workspace-namespace' } },
    );
    await waitForNextUpdate();

    expect(listSecrets).toHaveBeenCalledWith('workspace-namespace');

    rerender({ namespace: 'other-namespace' });
    await waitForNextUpdate();

    expect(listSecrets).toHaveBeenCalledWith('other-namespace');
  });
});
