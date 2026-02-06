import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useSecretContents from '~/app/hooks/useSecretContents';
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

describe('useSecretContents', () => {
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

    const { result } = renderHook(() =>
      useSecretContents({ isOpen: true, secretName: 'my-secret' }),
    );

    const [contents, loaded] = result.current;
    expect(contents).toEqual([]);
    expect(loaded).toBe(false);
  });

  it('returns initial state when modal is not open', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() =>
      useSecretContents({ isOpen: false, secretName: 'my-secret' }),
    );

    const [contents, loaded] = result.current;
    expect(contents).toEqual([]);
    expect(loaded).toBe(false);
  });

  it('returns initial state when secretName is undefined', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result } = renderHook(() => useSecretContents({ isOpen: true, secretName: undefined }));

    const [contents, loaded] = result.current;
    expect(contents).toEqual([]);
    expect(loaded).toBe(false);
  });

  it('fetches and decodes secret contents when API is available', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: {
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
      useSecretContents({ isOpen: true, secretName: 'my-secret' }),
    );
    await waitForNextUpdate();

    const [contents, loaded, error] = result.current;
    expect(getSecret).toHaveBeenCalledWith('test-namespace', 'my-secret');
    expect(contents).toEqual([
      { key: 'KEY1', value: 'value1' },
      { key: 'KEY2', value: 'value2' },
    ]);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('returns empty array when secret has no contents', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: { contents: {} },
    });
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { getSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useSecretContents({ isOpen: true, secretName: 'empty-secret' }),
    );
    await waitForNextUpdate();

    const [contents, loaded, error] = result.current;
    expect(contents).toEqual([]);
    expect(loaded).toBe(true);
    expect(error).toBeUndefined();
  });

  it('uses empty string when entry has no base64', async () => {
    const getSecret = jest.fn().mockResolvedValue({
      data: {
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
      useSecretContents({ isOpen: true, secretName: 'my-secret' }),
    );
    await waitForNextUpdate();

    const [contents] = result.current;
    expect(contents).toEqual([{ key: 'NO_BASE64', value: '' }]);
  });
});
