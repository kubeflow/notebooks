import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useWorkspacesByKind, useWorkspacesByNamespace } from '~/app/hooks/useWorkspaces';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  buildMockImageConfig,
  buildMockOptionInfo,
  buildMockPodConfig,
  buildMockPodTemplate,
  buildMockWorkspace,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceList,
  buildPodTemplateOptions,
} from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useWorkspacesByNamespace', () => {
    it('returns error when API unavailable', async () => {
      mockUseNotebookAPI.mockReturnValue({
        api: {} as NotebookApis,
        apiAvailable: false,
        refreshAllAPI: jest.fn(),
      });
      const { result, waitForNextUpdate } = renderHook(() => useWorkspacesByNamespace('ns'));
      await waitForNextUpdate();

      const [workspaces, loaded, error] = result.current;
      expect(workspaces).toEqual([]);
      expect(loaded).toBe(false);
      expect(error).toBeDefined();
    });

    it('fetches workspaces by namespace', async () => {
      const mockWorkspace = buildMockWorkspace({});
      const mockWorkspaces = buildMockWorkspaceList({
        count: 10,
        namespace: 'ns',
        kind: mockWorkspace.workspaceKind,
      });
      const listWorkspacesByNamespace = jest
        .fn()
        .mockResolvedValue({ ok: true, data: mockWorkspaces });
      const api = { workspaces: { listWorkspacesByNamespace } } as unknown as NotebookApis;

      mockUseNotebookAPI.mockReturnValue({
        api,
        apiAvailable: true,
        refreshAllAPI: jest.fn(),
      });

      const { result, waitForNextUpdate } = renderHook(() => useWorkspacesByNamespace('ns'));
      await waitForNextUpdate();

      const [workspaces, loaded, error] = result.current;
      expect(workspaces).toEqual(mockWorkspaces);
      expect(loaded).toBe(true);
      expect(error).toBeUndefined();
    });
  });

  describe('useWorkspacesByKind', () => {
    it('returns error when API unavailable', async () => {
      mockUseNotebookAPI.mockReturnValue({
        api: {} as NotebookApis,
        apiAvailable: false,
        refreshAllAPI: jest.fn(),
      });
      const { result, waitForNextUpdate } = renderHook(() =>
        useWorkspacesByKind({ kind: 'jupyter' }),
      );
      await waitForNextUpdate();

      const [workspaces, loaded, error] = result.current;
      expect(workspaces).toEqual([]);
      expect(loaded).toBe(false);
      expect(error).toBeDefined();
    });

    it('returns default state and error when kind missing', async () => {
      mockUseNotebookAPI.mockReturnValue({
        api: {} as NotebookApis,
        apiAvailable: true,
        refreshAllAPI: jest.fn(),
      });
      const { result, waitForNextUpdate } = renderHook(() => useWorkspacesByKind({ kind: '' }));
      await waitForNextUpdate();

      const [workspaces, loaded, error] = result.current;
      expect(workspaces).toEqual([]);
      expect(loaded).toBe(false);
      expect(error).toBeDefined();
    });

    it('filters workspaces by given criteria', async () => {
      const mockWorkspace1 = buildMockWorkspace({
        name: 'workspace1',
        namespace: 'ns1',
        workspaceKind: buildMockWorkspaceKindInfo({ name: 'kind1' }),
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: buildMockImageConfig({
              current: buildMockOptionInfo({ id: 'img1' }),
            }),
            podConfig: buildMockPodConfig({
              current: buildMockOptionInfo({ id: 'pod1' }),
            }),
          }),
        }),
      });
      const mockWorkspace2 = buildMockWorkspace({
        name: 'workspace2',
        namespace: 'ns2',
        workspaceKind: buildMockWorkspaceKindInfo({ name: 'kind1' }),
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: buildMockImageConfig({
              current: buildMockOptionInfo({ id: 'img2' }),
            }),
            podConfig: buildMockPodConfig({
              current: buildMockOptionInfo({ id: 'pod2' }),
            }),
          }),
        }),
      });
      const mockWorkspace3 = buildMockWorkspace({
        name: 'workspace3',
        namespace: 'ns1',
        workspaceKind: buildMockWorkspaceKindInfo({ name: 'kind2' }),
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: buildMockImageConfig({
              current: buildMockOptionInfo({ id: 'img1' }),
            }),
            podConfig: buildMockPodConfig({
              current: buildMockOptionInfo({ id: 'pod1' }),
            }),
          }),
        }),
      });
      const mockWorkspaces = [mockWorkspace1, mockWorkspace2, mockWorkspace3];

      const listAllWorkspaces = jest.fn().mockResolvedValue({ ok: true, data: mockWorkspaces });
      const api = { workspaces: { listAllWorkspaces } } as unknown as NotebookApis;
      mockUseNotebookAPI.mockReturnValue({
        api,
        apiAvailable: true,
        refreshAllAPI: jest.fn(),
      });

      const { result, waitForNextUpdate, rerender } = renderHook(
        (props) => useWorkspacesByKind(props),
        {
          initialProps: {
            kind: 'kind1',
            namespace: 'ns1',
            imageId: 'img1',
            podConfigId: 'pod1',
          },
        },
      );

      const [workspaces, loaded, error] = result.current;
      expect(workspaces).toEqual([]);
      expect(loaded).toBe(false);
      expect(error).toBeUndefined();

      await waitForNextUpdate();

      const [workspaces2, loaded2, error2] = result.current;
      expect(workspaces2).toEqual([mockWorkspace1]);
      expect(loaded2).toBe(true);
      expect(error2).toBeUndefined();

      rerender({ kind: 'kind2', namespace: 'ns1', imageId: 'img1', podConfigId: 'pod1' });
      await waitForNextUpdate();

      const [workspaces3, loaded3, error3] = result.current;
      expect(workspaces3).toEqual([mockWorkspace3]);
      expect(loaded3).toBe(true);
      expect(error3).toBeUndefined();
    });
  });
});
