import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import useNamespaces from '~/app/hooks/useNamespaces';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { NotebookApis } from '~/shared/api/notebookApi';
import { APIState } from '~/shared/api/types';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useNamespaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when API not available', async () => {
    const unavailableState: APIState<NotebookApis> = {
      apiAvailable: false,
      api: {} as NotebookApis,
    };
    mockUseNotebookAPI.mockReturnValue({ ...unavailableState, refreshAllAPI: jest.fn() });

    const { result, waitForNextUpdate } = renderHook(() => useNamespaces());
    await waitForNextUpdate();

    const [namespacesData, loaded, loadError] = result.current;
    expect(namespacesData).toBeNull();
    expect(loaded).toBe(false);
    expect(loadError).toBeDefined();
  });

  it('returns data when API is available', async () => {
    const listNamespaces = jest.fn().mockResolvedValue({ ok: true, data: [{ name: 'ns1' }] });
    const api = { namespaces: { listNamespaces } } as unknown as NotebookApis;

    const availableState: APIState<NotebookApis> = {
      apiAvailable: true,
      api,
    };
    mockUseNotebookAPI.mockReturnValue({ ...availableState, refreshAllAPI: jest.fn() });

    const { result, waitForNextUpdate } = renderHook(() => useNamespaces());
    await waitForNextUpdate();

    const [namespacesData, loaded, loadError] = result.current;
    expect(namespacesData).toEqual([{ name: 'ns1' }]);
    expect(loaded).toBe(true);
    expect(loadError).toBeUndefined();
  });
});
