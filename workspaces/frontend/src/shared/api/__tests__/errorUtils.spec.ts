import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';
import { ErrorEnvelopeException } from '~/shared/api/apiUtils';
import { ErrorEnvelope } from '~/shared/api/backendApiTypes';
import { handleRestFailures } from '~/shared/api/errorUtils';
import { NotReadyError } from '~/shared/utilities/useFetchState';

describe('handleRestFailures', () => {
  it('should successfully return namespaces', async () => {
    const result = await handleRestFailures(Promise.resolve(mockBFFResponse(mockNamespaces)));
    expect(result.data).toStrictEqual(mockNamespaces);
  });

  it('should handle and throw notebook errors', async () => {
    const errorEnvelope: ErrorEnvelope = {
      error: {
        code: '<error_code>',
        message: '<error_message>',
      },
    };
    const expectedError = new ErrorEnvelopeException(errorEnvelope);
    await expect(handleRestFailures(Promise.reject(errorEnvelope))).rejects.toThrow(expectedError);
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
