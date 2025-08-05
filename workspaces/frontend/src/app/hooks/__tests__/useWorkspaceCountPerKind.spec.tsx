import { waitFor } from '@testing-library/react';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import {
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
  WorkspacekindsWorkspaceKind,
  WorkspacesWorkspace,
  WorkspacesWorkspaceKindInfo,
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

const baseImageConfigTest: WorkspacekindsImageConfigValue = {
  id: 'image',
  displayName: 'Image',
  description: 'Test image',
  labels: [],
  hidden: false,
  clusterMetrics: undefined,
};

const basePodConfigTest: WorkspacekindsPodConfigValue = {
  id: 'podConfig',
  displayName: 'Pod Config',
  description: 'Test pod config',
  labels: [],
  hidden: false,
  clusterMetrics: undefined,
};

describe('useWorkspaceCountPerKind', () => {
  const mockListAllWorkspaces = jest.fn();
  const mockListWorkspaceKinds = jest.fn();

  const mockApi: Partial<NotebookApis> = {
    workspaces: {
      listAllWorkspaces: mockListAllWorkspaces,
      listWorkspacesByNamespace: jest.fn(),
      createWorkspace: jest.fn(),
      updateWorkspacePauseState: jest.fn(),
      getWorkspace: jest.fn(),
      deleteWorkspace: jest.fn(),
    },
    workspaceKinds: {
      listWorkspaceKinds: mockListWorkspaceKinds,
      createWorkspaceKind: jest.fn(),
      getWorkspaceKind: jest.fn(),
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
      expect(result.current).toEqual({});
    });
  });

  it('should fetch and calculate workspace counts on mount', async () => {
    const mockWorkspaces: WorkspacesWorkspace[] = [
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

    const mockWorkspaceKinds: WorkspacekindsWorkspaceKind[] = [
      buildMockWorkspaceKind({
        name: 'jupyter1',
        clusterMetrics: { workspacesCount: 10 },
        podTemplate: {
          podMetadata: { labels: {}, annotations: {} },
          volumeMounts: { home: '/home' },
          options: {
            imageConfig: {
              default: 'image1',
              values: [
                {
                  ...baseImageConfigTest,
                  id: 'image1',
                  clusterMetrics: { workspacesCount: 1 },
                },
                {
                  ...baseImageConfigTest,
                  id: 'image2',
                  clusterMetrics: { workspacesCount: 2 },
                },
              ],
            },
            podConfig: {
              default: 'podConfig1',
              values: [
                {
                  ...basePodConfigTest,
                  id: 'podConfig1',
                  clusterMetrics: { workspacesCount: 3 },
                },
                {
                  ...basePodConfigTest,
                  id: 'podConfig2',
                  clusterMetrics: { workspacesCount: 4 },
                },
              ],
            },
          },
        },
      }),
      buildMockWorkspaceKind({
        name: 'jupyter2',
        clusterMetrics: { workspacesCount: 20 },
        podTemplate: {
          podMetadata: { labels: {}, annotations: {} },
          volumeMounts: { home: '/home' },
          options: {
            imageConfig: {
              default: 'image1',
              values: [
                {
                  ...baseImageConfigTest,
                  id: 'image1',
                  clusterMetrics: { workspacesCount: 11 },
                },
              ],
            },
            podConfig: {
              default: 'podConfig1',
              values: [
                {
                  ...basePodConfigTest,
                  id: 'podConfig1',
                  clusterMetrics: { workspacesCount: 12 },
                },
              ],
            },
          },
        },
      }),
    ];

    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: mockWorkspaces });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: mockWorkspaceKinds });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current).toEqual({
        jupyter1: {
          count: 10,
          countByImage: {
            image1: 1,
            image2: 2,
          },
          countByPodConfig: {
            podConfig1: 3,
            podConfig2: 4,
          },
          countByNamespace: {
            namespace1: 2,
          },
        },
        jupyter2: {
          count: 20,
          countByImage: {
            image1: 11,
          },
          countByPodConfig: {
            podConfig1: 12,
          },
          countByNamespace: {
            namespace2: 1,
          },
        },
      });
    });
  });

  it('should handle missing cluster metrics gracefully', async () => {
    const mockEmptyWorkspaces: WorkspacesWorkspace[] = [];
    const mockWorkspaceKinds: WorkspacekindsWorkspaceKind[] = [
      buildMockWorkspaceKind({
        name: 'no-metrics',
        clusterMetrics: undefined,
        podTemplate: {
          podMetadata: { labels: {}, annotations: {} },
          volumeMounts: { home: '/home' },
          options: {
            imageConfig: {
              default: baseImageConfigTest.id,
              values: [{ ...baseImageConfigTest }],
            },
            podConfig: {
              default: basePodConfigTest.id,
              values: [{ ...basePodConfigTest }],
            },
          },
        },
      }),
      buildMockWorkspaceKind({
        name: 'no-metrics-2',
        clusterMetrics: undefined,
        podTemplate: {
          podMetadata: { labels: {}, annotations: {} },
          volumeMounts: { home: '/home' },
          options: {
            imageConfig: {
              default: 'empty',
              values: [],
            },
            podConfig: {
              default: 'empty',
              values: [],
            },
          },
        },
      }),
    ];

    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: mockEmptyWorkspaces });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: mockWorkspaceKinds });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current).toEqual({
        'no-metrics': {
          count: 0,
          countByImage: {
            image: 0,
          },
          countByPodConfig: {
            podConfig: 0,
          },
          countByNamespace: {},
        },
        'no-metrics-2': {
          count: 0,
          countByImage: {},
          countByPodConfig: {},
          countByNamespace: {},
        },
      });
    });
  });

  it('should return empty object in case of API errors rather than propagating them', async () => {
    mockListAllWorkspaces.mockRejectedValue(new Error('API Error'));
    mockListWorkspaceKinds.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });

  it('should handle empty workspace kinds array', async () => {
    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: [] });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: [] });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });

  it('should handle workspaces with no matching kinds', async () => {
    const mockWorkspaces: WorkspacesWorkspace[] = [baseWorkspaceTest];
    const workspaceKind = buildMockWorkspaceKind({
      name: 'nomatch',
      clusterMetrics: { workspacesCount: 0 },
      podTemplate: {
        podMetadata: { labels: {}, annotations: {} },
        volumeMounts: { home: '/home' },
        options: {
          imageConfig: {
            default: baseImageConfigTest.id,
            values: [{ ...baseImageConfigTest }],
          },
          podConfig: {
            default: basePodConfigTest.id,
            values: [{ ...basePodConfigTest }],
          },
        },
      },
    });

    const mockWorkspaceKinds: WorkspacekindsWorkspaceKind[] = [workspaceKind];

    mockListAllWorkspaces.mockResolvedValue({ ok: true, data: mockWorkspaces });
    mockListWorkspaceKinds.mockResolvedValue({ ok: true, data: mockWorkspaceKinds });

    const { result } = renderHook(() => useWorkspaceCountPerKind());

    await waitFor(() => {
      expect(result.current).toEqual({
        [workspaceKind.name]: {
          count: 0,
          countByImage: { [baseImageConfigTest.id]: 0 },
          countByPodConfig: { [basePodConfigTest.id]: 0 },
          countByNamespace: {},
        },
      });
    });
  });
});
