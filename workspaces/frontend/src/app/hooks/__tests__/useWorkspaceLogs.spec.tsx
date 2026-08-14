import { act, waitFor } from '@testing-library/react';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspaceLogs, useWorkspaceLogsController } from '~/app/hooks/useWorkspaceLogs';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  buildMockWorkspace,
  buildMockWorkspaceDetails,
  buildMockWorkspaceLogs,
} from '~/shared/mock/mockBuilder';

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
        previous: true,
      }),
    );
    await waitForNextUpdate();

    expect(getWorkspacePodTemplateLogsBatch).toHaveBeenCalledWith('test-ns', 'test-workspace', {
      container: 'istio-proxy',
      tailLines: 100,
      sinceTime: undefined,
      previous: true,
    });
  });

  it('recomputes sinceTime relative to now on every fetch', async () => {
    const getWorkspacePodTemplateLogsBatch = jest.fn().mockResolvedValue('log line');
    const api = {
      workspaces: { getWorkspacePodTemplateLogsBatch },
    } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-01-01T00:00:00.000Z').getTime());

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceLogs('test-ns', 'test-workspace', { sinceWindowMs: 15 * 60 * 1000 }),
    );
    await waitForNextUpdate();

    expect(getWorkspacePodTemplateLogsBatch).toHaveBeenLastCalledWith(
      'test-ns',
      'test-workspace',
      expect.objectContaining({ sinceTime: '2025-12-31T23:45:00.000Z' }),
    );

    // Advance the clock and refresh without changing the window: the window must slide.
    nowSpy.mockReturnValue(new Date('2026-01-01T00:30:00.000Z').getTime());
    await act(async () => {
      result.current[3]();
    });

    await waitFor(() =>
      expect(getWorkspacePodTemplateLogsBatch).toHaveBeenLastCalledWith(
        'test-ns',
        'test-workspace',
        expect.objectContaining({ sinceTime: '2026-01-01T00:15:00.000Z' }),
      ),
    );

    nowSpy.mockRestore();
  });
});

describe('useWorkspaceLogsController', () => {
  const workspaceA = buildMockWorkspace({ name: 'workspace-a', namespace: 'test-ns' });
  const workspaceB = buildMockWorkspace({ name: 'workspace-b', namespace: 'test-ns' });

  beforeEach(() => {
    jest.clearAllMocks();
    const getWorkspacePodTemplateLogsBatch = jest.fn().mockResolvedValue('log line');
    mockUseNotebookAPI.mockReturnValue({
      api: { workspaces: { getWorkspacePodTemplateLogsBatch } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
  });

  it('defaults to the primary container', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceLogsController(workspaceA, buildMockWorkspaceDetails()),
    );
    await waitForNextUpdate();

    expect(result.current.container).toBe('main');
    expect(result.current.containerOptions).toEqual([
      { key: 'container/main', name: 'main', isInit: false },
      { key: 'init/istio-proxy', name: 'istio-proxy', isInit: true },
    ]);
  });

  it('resets the selected container when the workspace changes', async () => {
    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ workspace }) => useWorkspaceLogsController(workspace, buildMockWorkspaceDetails()),
      { initialProps: { workspace: workspaceA } },
    );
    await waitForNextUpdate();

    act(() => {
      result.current.selectContainer('init/istio-proxy');
    });
    expect(result.current.container).toBe('istio-proxy');

    rerender({ workspace: workspaceB });

    // The stale init container must not leak onto the new workspace's pod.
    await waitFor(() => expect(result.current.container).toBe('main'));
  });

  it('resets the scroll position when a filter changes', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspaceLogsController(workspaceA, buildMockWorkspaceDetails()),
    );
    await waitForNextUpdate();

    act(() => {
      result.current.setScrollToRow(500);
    });
    expect(result.current.scrollToRow).toBe(500);

    act(() => {
      result.current.setTailLines(100);
    });
    expect(result.current.scrollToRow).toBeUndefined();
  });
});
