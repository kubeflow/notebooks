import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspaceResourceUsage } from '~/app/hooks/useWorkspaceResourceUsage';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  buildMockContainerResourceUsage,
  buildMockWorkspaceResourceUsage,
} from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaceResourceUsage', () => {
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
      useWorkspaceResourceUsage('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    expect(result.current.resourceUsage).toBeNull();
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBeDefined();
    expect(result.current.containerNames).toEqual([]);
    expect(result.current.containers).toEqual({});
  });

  it('stays in initial state when namespace is undefined', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result } = renderHook(() => useWorkspaceResourceUsage(undefined, 'test-workspace'));

    expect(result.current.resourceUsage).toBeNull();
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.containerNames).toEqual([]);
  });

  it('stays in initial state when name is undefined', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result } = renderHook(() => useWorkspaceResourceUsage('test-ns', undefined));

    expect(result.current.resourceUsage).toBeNull();
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.containerNames).toEqual([]);
  });

  it('fetches resource usage successfully', async () => {
    const mockResourceUsage = buildMockWorkspaceResourceUsage();
    const getWorkspacePodTemplateResources = jest
      .fn()
      .mockResolvedValue({ data: mockResourceUsage });
    const api = {
      workspaces: { getWorkspacePodTemplateResources },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceResourceUsage('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    expect(result.current.resourceUsage).toEqual(mockResourceUsage);
    expect(result.current.loaded).toBe(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.containerNames).toEqual(['main', 'container1']);
    expect(result.current.containers).toEqual(mockResourceUsage.containers);
    expect(getWorkspacePodTemplateResources).toHaveBeenCalledWith('test-ns', 'test-workspace');
  });

  it('returns multiple container names for multi-container pods', async () => {
    const mockResourceUsage = buildMockWorkspaceResourceUsage({
      containers: {
        main: buildMockContainerResourceUsage(),
        'istio-proxy': buildMockContainerResourceUsage(),
      },
    });
    const getWorkspacePodTemplateResources = jest
      .fn()
      .mockResolvedValue({ data: mockResourceUsage });
    const api = {
      workspaces: { getWorkspacePodTemplateResources },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceResourceUsage('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    expect(result.current.containerNames).toEqual(['main', 'istio-proxy']);
    expect(result.current.containers['istio-proxy']).toBeDefined();
  });

  it('returns empty containers when error is present', async () => {
    const mockResourceUsage = buildMockWorkspaceResourceUsage({
      error: 'WORKSPACE_NOT_RUNNING' as never,
      containers: undefined,
    });
    const getWorkspacePodTemplateResources = jest
      .fn()
      .mockResolvedValue({ data: mockResourceUsage });
    const api = {
      workspaces: { getWorkspacePodTemplateResources },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceResourceUsage('test-ns', 'test-workspace'),
    );
    await waitForNextUpdate();

    expect(result.current.loaded).toBe(true);
    expect(result.current.containerNames).toEqual([]);
    expect(result.current.containers).toEqual({});
  });
});
