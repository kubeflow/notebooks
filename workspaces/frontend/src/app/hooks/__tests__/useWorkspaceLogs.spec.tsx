import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspaceLogs } from '~/app/hooks/useWorkspaceLogs';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceLogs } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaceLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns error when API unavailable', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceLogs('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeDefined();
  });

  it('stays in initial state when namespace is undefined', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result } = renderHook(() => useWorkspaceLogs(undefined, 'test-workspace'));

    const [data, loaded, error] = result.current;
    expect(data).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeUndefined();
  });

  it('stays in initial state when name is undefined', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result } = renderHook(() => useWorkspaceLogs('test-ns', undefined));

    const [data, loaded, error] = result.current;
    expect(data).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeUndefined();
  });

  it('fetches the raw log text without unwrapping an envelope', async () => {
    const mockLogs = buildMockWorkspaceLogs(3);
    const getWorkspacePodTemplateLogsBatch = jest.fn().mockResolvedValue(mockLogs);
    const api = {
      workspaces: { getWorkspacePodTemplateLogsBatch },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceLogs('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toEqual(mockLogs);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('forwards the log options as query parameters', async () => {
    const getWorkspacePodTemplateLogsBatch = jest.fn().mockResolvedValue('log line');
    const api = {
      workspaces: { getWorkspacePodTemplateLogsBatch },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { waitForNextUpdate } = renderHook(() =>
      useWorkspaceLogs('test-ns', 'test-workspace', {
        container: 'istio-proxy',
        tailLines: 100,
        sinceTime: '2026-07-15T10:30:00Z',
        previous: true,
      }),
    );
    await waitForNextUpdate();

    expect(getWorkspacePodTemplateLogsBatch).toHaveBeenCalledWith('test-ns', 'test-workspace', {
      container: 'istio-proxy',
      tailLines: 100,
      sinceTime: '2026-07-15T10:30:00Z',
      previous: true,
    });
  });
});
