import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspaceDetails } from '~/app/hooks/useWorkspaceDetails';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceDetails } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaceDetails', () => {
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
      useWorkspaceDetails('test-ns', 'test-workspace'),
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
    const { result } = renderHook(() => useWorkspaceDetails(undefined, 'test-workspace'));

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
    const { result } = renderHook(() => useWorkspaceDetails('test-ns', undefined));

    const [data, loaded, error] = result.current;
    expect(data).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeUndefined();
  });

  it('fetches workspace details successfully', async () => {
    const mockDetails = buildMockWorkspaceDetails();
    const getWorkspacePodTemplateDetails = jest.fn().mockResolvedValue({ data: mockDetails });
    const api = {
      workspaces: { getWorkspacePodTemplateDetails },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceDetails('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toEqual(mockDetails);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
    expect(getWorkspacePodTemplateDetails).toHaveBeenCalledWith('test-ns', 'test-workspace');
  });
});
