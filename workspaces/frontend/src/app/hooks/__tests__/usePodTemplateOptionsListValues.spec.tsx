import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import usePodTemplateOptionsListValues from '~/app/hooks/usePodTemplateOptionsListValues';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('usePodTemplateOptionsListValues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when API not available', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      usePodTemplateOptionsListValues({
        kindName: 'jupyterlab',
        namespace: 'default',
        imageId: undefined,
      }),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeDefined();
  });

  it('rejects when kindName is undefined', async () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      usePodTemplateOptionsListValues({
        kindName: undefined,
        namespace: 'default',
        imageId: undefined,
      }),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toBeNull();
    expect(loaded).toBe(false);
    expect(error).toBeDefined();
  });

  it('returns options when API is available and kindName is provided', async () => {
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const mockResponse = {
      imageConfig: mockWorkspaceKind.podTemplate.options.imageConfig,
      podConfig: mockWorkspaceKind.podTemplate.options.podConfig,
    };

    const podTemplateOptionsListValues = jest
      .fn()
      .mockResolvedValue({ ok: true, data: mockResponse });
    mockUseNotebookAPI.mockReturnValue({
      api: {
        workspaceKinds: { podTemplateOptionsListValues },
      } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      usePodTemplateOptionsListValues({
        kindName: 'jupyterlab',
        namespace: 'default',
        imageId: undefined,
      }),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toEqual(mockResponse);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
    expect(podTemplateOptionsListValues).toHaveBeenCalledWith('jupyterlab', {
      data: {
        context: {
          namespace: { name: 'default' },
        },
      },
    });
  });

  it('sends imageConfig context when imageId is provided', async () => {
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const mockResponse = {
      imageConfig: mockWorkspaceKind.podTemplate.options.imageConfig,
      podConfig: mockWorkspaceKind.podTemplate.options.podConfig,
    };

    const podTemplateOptionsListValues = jest
      .fn()
      .mockResolvedValue({ ok: true, data: mockResponse });
    mockUseNotebookAPI.mockReturnValue({
      api: {
        workspaceKinds: { podTemplateOptionsListValues },
      } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      usePodTemplateOptionsListValues({
        kindName: 'jupyterlab',
        namespace: 'default',
        imageId: 'jupyterlab_scipy_190',
      }),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toEqual(mockResponse);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
    expect(podTemplateOptionsListValues).toHaveBeenCalledWith('jupyterlab', {
      data: {
        context: {
          namespace: { name: 'default' },
          imageConfig: { id: 'jupyterlab_scipy_190' },
        },
      },
    });
  });

  it('sends no namespace context when namespace is undefined', async () => {
    const mockWorkspaceKind = buildMockWorkspaceKind({});
    const mockResponse = {
      imageConfig: mockWorkspaceKind.podTemplate.options.imageConfig,
      podConfig: mockWorkspaceKind.podTemplate.options.podConfig,
    };

    const podTemplateOptionsListValues = jest
      .fn()
      .mockResolvedValue({ ok: true, data: mockResponse });
    mockUseNotebookAPI.mockReturnValue({
      api: {
        workspaceKinds: { podTemplateOptionsListValues },
      } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      usePodTemplateOptionsListValues({
        kindName: 'jupyterlab',
        namespace: undefined,
        imageId: undefined,
      }),
    );
    await waitForNextUpdate();

    const [data, loaded, error] = result.current;
    expect(data).toEqual(mockResponse);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
    expect(podTemplateOptionsListValues).toHaveBeenCalledWith('jupyterlab', {
      data: {
        context: {
          namespace: undefined,
        },
      },
    });
  });
});
