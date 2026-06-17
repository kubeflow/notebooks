import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useSecret from '~/app/hooks/useSecret';
import { NotebookApis } from '~/shared/api/notebookApi';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));
jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;
const mockUseNamespaceSelectorWrapper = useNamespaceSelectorWrapper as jest.MockedFunction<
  typeof useNamespaceSelectorWrapper
>;

describe('useSecret', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNamespaceSelectorWrapper.mockReturnValue({
      selectedNamespace: 'test-namespace',
      namespacesLoaded: true,
    } as ReturnType<typeof useNamespaceSelectorWrapper>);
  });

  it('returns initial state when API is not available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useSecret({ isOpen: true, secretName: 'my-secret' }));

    const [details, loaded] = result.current;
    expect(details).toEqual({ keyValuePairs: [], immutable: false, type: 'Opaque' });
    expect(loaded).toBe(false);
  });

  it('returns initial state when modal is not open', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useSecret({ isOpen: false, secretName: 'my-secret' }));

    const [details, loaded] = result.current;
    expect(details).toEqual({ keyValuePairs: [], immutable: false, type: 'Opaque' });
    expect(loaded).toBe(false);
  });

  it('returns initial state when secretName is undefined', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useSecret({ isOpen: true, secretName: undefined }));

    const [details, loaded] = result.current;
    expect(details).toEqual({ keyValuePairs: [], immutable: false, type: 'Opaque' });
    expect(loaded).toBe(false);
  });

  it('fetches and decodes secret contents when API is available', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: {
        type: 'Opaque',
        immutable: false,
        contents: {
          KEY1: { base64: Buffer.from('value1').toString('base64') },
          KEY2: { base64: Buffer.from('value2').toString('base64') },
        },
      },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'my-secret' }),
    );
    await waitForNextUpdate();

    const [details, loaded, error] = result.current;
    expect(getSecret).toHaveBeenCalledWith('test-namespace', 'my-secret');
    expect(details.keyValuePairs).toEqual([
      { key: 'KEY1', value: 'value1' },
      { key: 'KEY2', value: 'value2' },
    ]);
    expect(details.immutable).toBe(false);
    expect(details.type).toBe('Opaque');
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('returns immutable and type from the GET response', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: {
        type: 'kubernetes.io/tls',
        immutable: true,
        contents: {
          'tls.crt': { base64: Buffer.from('cert').toString('base64') },
        },
      },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'tls-secret' }),
    );
    await waitForNextUpdate();

    const [details, loaded] = result.current;
    expect(details.immutable).toBe(true);
    expect(details.type).toBe('kubernetes.io/tls');
    expect(details.keyValuePairs).toEqual([{ key: 'tls.crt', value: 'cert' }]);
    expect(loaded).toBe(true);
  });

  it('returns empty keyValuePairs when secret has no contents', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: { type: 'Opaque', immutable: false, contents: {} },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'empty-secret' }),
    );
    await waitForNextUpdate();

    const [details, loaded, error] = result.current;
    expect(details.keyValuePairs).toEqual([]);
    expect(details.immutable).toBe(false);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('uses empty string when entry has no base64', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: {
        type: 'Opaque',
        immutable: false,
        contents: {
          NO_BASE64: {},
        },
      },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'my-secret' }),
    );
    await waitForNextUpdate();

    const [details] = result.current;
    expect(details.keyValuePairs).toEqual([{ key: 'NO_BASE64', value: '' }]);
  });
});
