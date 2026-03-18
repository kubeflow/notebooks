import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useStorageClasses from '~/app/hooks/useStorageClasses';
import { NotebookApis } from '~/shared/api/notebookApi';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useStorageClasses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty list and no error when API is not yet available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useStorageClasses());

    expect(result.current.storageClasses).toEqual([]);
    expect(result.current.storageClassLoadError).toBeNull();
  });

  it('returns storage classes and no error when fetch succeeds', async () => {
    const mockClasses = [
      { name: 'standard', displayName: 'Standard', canUse: true, description: '' },
      { name: 'fast', displayName: 'Fast SSD', canUse: false, description: 'NVMe' },
    ];
    const listStorageClasses = jest.fn().mockResolvedValue({ data: mockClasses });

    mockUseNotebookAPI.mockReturnValue({
      api: { storageClasses: { listStorageClasses } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useStorageClasses());
    await waitForNextUpdate();

    expect(listStorageClasses).toHaveBeenCalledTimes(1);
    expect(result.current.storageClasses).toEqual(mockClasses);
    expect(result.current.storageClassLoadError).toBeNull();
  });

  it('returns empty list and user-facing error message when fetch fails', async () => {
    const listStorageClasses = jest.fn().mockRejectedValue(new Error('network error'));

    mockUseNotebookAPI.mockReturnValue({
      api: { storageClasses: { listStorageClasses } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() => useStorageClasses());
    await waitForNextUpdate();

    expect(result.current.storageClasses).toEqual([]);
    expect(result.current.storageClassLoadError).toBe(
      'Storage classes could not be loaded. Enter a class name manually.',
    );
  });
});
