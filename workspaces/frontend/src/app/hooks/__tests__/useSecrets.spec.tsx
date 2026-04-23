import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useSecrets from '~/app/hooks/useSecrets';
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

describe('useSecrets', () => {
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

    const { result } = renderHook(() => useSecrets());

    expect(result.current.secrets).toEqual([]);
    expect(result.current.secretsLoaded).toBe(false);
    expect(result.current.secretLoadError).toBeNull();
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

    const { result } = renderHook(() => useSecrets());

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

    const { result, waitForNextUpdate } = renderHook(() => useSecrets());
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

    const { result, waitForNextUpdate } = renderHook(() => useSecrets());
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

    const { result, waitForNextUpdate } = renderHook(() => useSecrets());
    await waitForNextUpdate();

    expect(typeof result.current.refreshSecrets).toBe('function');
  });
});
