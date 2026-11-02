import { waitFor } from '@testing-library/react';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import {
  WorkspacekindsWorkspaceKindListItem,
  WorkspacesWorkspaceKindInfo,
  WorkspacesWorkspaceListItem,
} from '~/generated/data-contracts';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

const baseWorkspaceKindInfoTest: WorkspacesWorkspaceKindInfo = {
  name: 'jupyter',
  missing: false,
  icon: { url: '' },
  logo: { url: '' },
};

const baseWorkspaceTest = buildMockWorkspace({
  name: 'workspace',
  namespace: 'namespace',
  workspaceKind: baseWorkspaceKindInfoTest,
});

describe('useWorkspaceCountPerKind', () => {
  const mockListAllWorkspaces = jest.fn();
  const mockListWorkspaceKinds = jest.fn();

  const mockApi: Partial<NotebookApis> = {
    workspaces: {
      listAllWorkspaces: mockListAllWorkspaces,
      listWorkspacesByNamespace: jest.fn(),
      createWorkspace: jest.fn(),
      updateWorkspace: jest.fn(),
      updateWorkspacePauseState: jest.fn(),
      getWorkspace: jest.fn(),
      deleteWorkspace: jest.fn(),
      getWorkspacePodTemplateDetails: jest.fn(),
      getWorkspacePodTemplateLogsBatch: jest.fn(),
      getWorkspacePodTemplateResources: jest.fn(),
    },
    workspaceKinds: {
      listWorkspaceKinds: mockListWorkspaceKinds,
      createWorkspaceKind: jest.fn(),
      getWorkspaceKind: jest.fn(),
      updateWorkspaceKind: jest.fn(),
      deleteWorkspaceKind: jest.fn(),
      podTemplateOptionsListValues: jest.fn(),
      getWorkspaceKindIcon: jest.fn(),
      getWorkspaceKindLogo: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNotebookAPI.mockReturnValue({
      api: mockApi as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
  });

  it('should return empty object initially', () => {
    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: [] });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    waitFor(() => {
      expect(result.current.workspaceCountPerKind).toEqual({});
      expect(result.current.error).toBeNull();
    });
  });

  it('should fetch and calculate workspace counts on mount', async () => {
    const mockWorkspaces: WorkspacesWorkspaceListItem[] = [
      {
        ...baseWorkspaceTest,
        name: 'workspace1',
        namespace: 'namespace1',
        workspaceKind: { ...baseWorkspaceKindInfoTest, name: 'jupyter1' },
      },
      {
        ...baseWorkspaceTest,
        name: 'workspace2',
        namespace: 'namespace1',
        workspaceKind: { ...baseWorkspaceKindInfoTest, name: 'jupyter1' },
      },
      {
        ...baseWorkspaceTest,
        name: 'workspace3',
        namespace: 'namespace2',
        workspaceKind: { ...baseWorkspaceKindInfoTest, name: 'jupyter2' },
      },
    ];

    const mockWorkspaceKinds: WorkspacekindsWorkspaceKindListItem[] = [
      buildMockWorkspaceKind({
        name: 'jupyter1',
        clusterMetrics: { workspacesCount: 10 },
      }),
      buildMockWorkspaceKind({
        name: 'jupyter2',
        clusterMetrics: { workspacesCount: 20 },
      }),
    ];

    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: mockWorkspaces });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: mockWorkspaceKinds });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current.workspaceCountPerKind).toEqual({
        jupyter1: {
          count: 10,
          countByNamespace: {
            namespace1: 2,
          },
        },
        jupyter2: {
          count: 20,
          countByNamespace: {
            namespace2: 1,
          },
        },
      });
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle zero workspace counts', async () => {
    const mockEmptyWorkspaces: WorkspacesWorkspaceListItem[] = [];
    const mockWorkspaceKinds: WorkspacekindsWorkspaceKindListItem[] = [
      buildMockWorkspaceKind({
        name: 'no-metrics',
        clusterMetrics: { workspacesCount: 0 },
      }),
      buildMockWorkspaceKind({
        name: 'no-metrics-2',
        clusterMetrics: { workspacesCount: 0 },
      }),
    ];

    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: mockEmptyWorkspaces });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: mockWorkspaceKinds });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current.workspaceCountPerKind).toEqual({
        'no-metrics': {
          count: 0,
          countByNamespace: {},
        },
        'no-metrics-2': {
          count: 0,
          countByNamespace: {},
        },
      });
      expect(result.current.error).toBeNull();
    });
  });

  it('should return error when API call fails', async () => {
    mockListAllWorkspaces.mockRejectedValue(new Error('API Error'));
    mockListWorkspaceKinds.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current.workspaceCountPerKind).toEqual({});
      expect(result.current.error).toBe('API Error');
    });
  });

  it('should handle empty workspace kinds array', async () => {
    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: [] });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current.workspaceCountPerKind).toEqual({});
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle workspaces with no matching kinds', async () => {
    const mockWorkspaces: WorkspacesWorkspaceListItem[] = [baseWorkspaceTest];
    const workspaceKind = buildMockWorkspaceKind({
      name: 'nomatch',
      clusterMetrics: { workspacesCount: 0 },
    });

    const mockWorkspaceKinds: WorkspacekindsWorkspaceKindListItem[] = [workspaceKind];

    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: mockWorkspaces });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: mockWorkspaceKinds });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current.workspaceCountPerKind).toEqual({
        [workspaceKind.name]: {
          count: 0,
          countByNamespace: {},
        },
      });
      expect(result.current.error).toBeNull();
    });
  });
});
