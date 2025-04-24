import { NotReadyError } from '~/shared/utilities/useFetchState';
import { APIError } from '~/shared/api/types';
import { handleRestFailures } from '~/shared/api/errorUtils';
import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';

describe('handleRestFailures', () => {
  it('should successfully return namespaces', async () => {
    const result = await handleRestFailures(Promise.resolve(mockBFFResponse(mockNamespaces)));
    expect(result.data).toStrictEqual(mockNamespaces);
  });

  it('should handle and throw notebook errors', async () => {
    const statusMock: APIError = {
      error: {
        code: '',
        message: 'error',
      },
    };

    await expect(handleRestFailures(Promise.resolve(statusMock))).rejects.toThrow('error');
  });

  it('should handle common state errors ', async () => {
    await expect(handleRestFailures(Promise.reject(new NotReadyError('error')))).rejects.toThrow(
      'error',
    );
  });

  it('should handle other errors', async () => {
    await expect(handleRestFailures(Promise.reject(new Error('error')))).rejects.toThrow(
      'Error communicating with server',
    );
  });
});
