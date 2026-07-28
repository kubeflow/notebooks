import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useWorkspacePodTemplateDetails from '~/app/hooks/useWorkspacePodTemplateDetails';
import { NotebookApis } from '~/shared/api/notebookApi';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useWorkspacePodTemplateDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when namespace or name is missing', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspacePodTemplateDetails(undefined, 'my-workspace'),
    );
    await waitForNextUpdate();

    const [details, loaded, error] = result.current;
    expect(details).toBeNull();
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('fetches workspace podtemplate details when parameters are valid', async () => {
    const mockDetailsData = {
      podMetadata: { labels: {}, annotations: {} },
      volumes: {},
      pod: { name: 'workspace-abc-0', nodeName: 'node-gpu-01' },
    };

    const getWorkspacePodTemplateDetails = jest
      .fn()
      .mockResolvedValue({ ok: true, data: mockDetailsData });

    const api = { workspaces: { getWorkspacePodTemplateDetails } } as unknown as NotebookApis;

    mockUseNotebookAPI.mockReturnValue({
      api,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWorkspacePodTemplateDetails('default', 'my-workspace'),
    );
    await waitForNextUpdate();

    const [details, loaded, error] = result.current;
    expect(details).toEqual(mockDetailsData);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
    expect(getWorkspacePodTemplateDetails).toHaveBeenCalledWith('default', 'my-workspace');
  });
});
