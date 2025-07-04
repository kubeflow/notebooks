import { ErrorEnvelopeException, isErrorEnvelope } from '~/shared/api//apiUtils';
import { isCommonStateError } from '~/shared/utilities/useFetchState';

export const handleRestFailures = <T>(promise: Promise<T>): Promise<T> =>
  promise.catch((e) => {
    if (isErrorEnvelope(e)) {
      throw new ErrorEnvelopeException(e);
    }
    if (isCommonStateError(e)) {
      // Common state errors are handled by useFetchState at storage level, let them deal with it
      throw e;
    }
    // eslint-disable-next-line no-console
    console.error('Unknown API error', e);
    throw new Error('Error communicating with server');
  });
