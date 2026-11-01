import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useSecret from '~/app/hooks/useSecret';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockSecretResponse } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

describe('useSecret', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns initial state when API is not available', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: false,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'my-secret', namespace: 'test-namespace' }),
    );

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

    const { result } = renderHook(() =>
      useSecret({ isOpen: false, secretName: 'my-secret', namespace: 'test-namespace' }),
    );

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

    const { result } = renderHook(() =>
      useSecret({ isOpen: true, secretName: undefined, namespace: 'test-namespace' }),
    );

    const [details, loaded] = result.current;
    expect(details).toEqual({ keyValuePairs: [], immutable: false, type: 'Opaque' });
    expect(loaded).toBe(false);
  });

  it('fetches undisclosed keys without decoding or exposing response values', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: {
        type: 'Opaque',
        immutable: false,
        contents: {
          KEY1: {},
          KEY2: { base64: '/wAB' },
        },
      },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'my-secret', namespace: 'test-namespace' }),
    );
    await waitForNextUpdate();

    const [details, loaded, error] = result.current;
    expect(getSecret).toHaveBeenCalledWith('test-namespace', 'my-secret');
    expect(details.keyValuePairs).toEqual([
      { key: 'KEY1', kind: 'unchanged' },
      { key: 'KEY2', kind: 'unchanged' },
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
          'tls.crt': {},
        },
      },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'tls-secret', namespace: 'test-namespace' }),
    );
    await waitForNextUpdate();

    const [details, loaded] = result.current;
    expect(details.immutable).toBe(true);
    expect(details.type).toBe('kubernetes.io/tls');
    expect(details.keyValuePairs).toEqual([{ key: 'tls.crt', kind: 'unchanged' }]);
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
      useSecret({ isOpen: true, secretName: 'empty-secret', namespace: 'test-namespace' }),
    );
    await waitForNextUpdate();

    const [details, loaded, error] = result.current;
    expect(details.keyValuePairs).toEqual([]);
    expect(details.immutable).toBe(false);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('models a redacted value separately from empty replacement text', async () => {
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
      useSecret({ isOpen: true, secretName: 'my-secret', namespace: 'test-namespace' }),
    );
    await waitForNextUpdate();

    const [details] = result.current;
    expect(details.keyValuePairs).toEqual([{ key: 'NO_BASE64', kind: 'unchanged' }]);
  });

  it('waits for a namespace before fetching secret metadata', () => {
    const getSecret = jest.fn();
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'my-secret', namespace: '' }),
    );
    expect(getSecret).not.toHaveBeenCalled();
    expect(result.current[1]).toBe(false);
  });

  it('surfaces a failed metadata request without loading editable data', async () => {
    const failure = new Error('forbidden');
    const getSecret = jest.fn().mockRejectedValue(failure);
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useSecret({ isOpen: true, secretName: 'my-secret', namespace: 'test-namespace' }),
    );
    await waitForNextUpdate();
    expect(result.current[0].keyValuePairs).toEqual([]);
    expect(result.current[1]).toBe(false);
    expect(result.current[2]).toBe(failure);
  });

  it('clears previous keys when the secret target changes', async () => {
    const getSecret = jest
      .fn()
      .mockResolvedValueOnce({
        data: buildMockSecretResponse({ contents: { first: {} } }),
      })
      .mockResolvedValueOnce({
        data: buildMockSecretResponse({ contents: { second: {} } }),
      });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ namespace, secretName }) => useSecret({ isOpen: true, namespace, secretName }),
      { initialProps: { namespace: 'namespace-a', secretName: 'secret-a' } },
    );
    await waitForNextUpdate();
    expect(result.current[0].keyValuePairs).toEqual([{ key: 'first', kind: 'unchanged' }]);
    rerender({ namespace: 'namespace-b', secretName: 'secret-b' });
    expect(result.current[0].keyValuePairs).toEqual([]);
    expect(result.current[1]).toBe(false);
    await waitForNextUpdate();
    expect(getSecret).toHaveBeenLastCalledWith('namespace-b', 'secret-b');
    expect(result.current[0].keyValuePairs).toEqual([{ key: 'second', kind: 'unchanged' }]);
  });
});
