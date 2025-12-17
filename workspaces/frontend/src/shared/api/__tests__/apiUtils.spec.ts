import axios, { AxiosError, AxiosHeaders } from 'axios';
import {
  safeApiCall,
  extractErrorMessage,
  extractValidationErrors,
  extractConflictCauses,
  formatValidationErrorMessages,
  formatConflictErrorMessages,
} from '~/shared/api/apiUtils';
import { ApiErrorCauseOrigin, ApiErrorEnvelope, FieldErrorType } from '~/generated/data-contracts';

// Helper to create mock Axios errors
const createAxiosError = (status: number, data?: unknown, code?: string): AxiosError<unknown> => {
  const error = new Error('Request failed') as AxiosError<unknown>;
  error.isAxiosError = true;
  error.response = {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  };
  error.config = { headers: new AxiosHeaders() };
  error.code = code;
  return error;
};

describe('safeApiCall', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return ok result when API call succeeds', async () => {
    const mockResult = { data: 'test' };
    const result = await safeApiCall(() => Promise.resolve(mockResult));

    expect(result).toEqual({ ok: true, result: mockResult });
  });

  it('should return error envelope when API returns ApiErrorEnvelope', async () => {
    const errorEnvelope = {
      error: {
        code: 'ERROR_CODE',
        message: 'Something went wrong',
      },
    };
    const axiosError = createAxiosError(400, errorEnvelope);

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const result = await safeApiCall(() => Promise.reject(axiosError));

    expect(result).toEqual({ ok: false, errorEnvelope });
  });

  it('should throw error when API error is not an ApiErrorEnvelope', async () => {
    const axiosError = createAxiosError(500, { unexpected: 'format' });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(safeApiCall(() => Promise.reject(axiosError))).rejects.toThrow();
  });

  it('should throw error when error is not an Axios error', async () => {
    const genericError = new Error('Generic error');

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);

    await expect(safeApiCall(() => Promise.reject(genericError))).rejects.toThrow('Generic error');
  });
});

describe('extractErrorMessage', () => {
  beforeEach(() => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return API error message when available', () => {
    const axiosError = createAxiosError(400, {
      error: { code: '400', message: 'Custom API error message' },
    });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const envelope: ApiErrorEnvelope = {
      error: { code: '400', message: 'Custom API error message' },
    };

    expect(extractErrorMessage(axiosError)).toEqual(envelope);
  });

  it('should return status-based message when no API error message is present', () => {
    const axiosError = createAxiosError(500, {});

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe(
      'An internal server error occurred. Please try again later.',
    );
  });

  it('should return network error message for ERR_NETWORK', () => {
    const axiosError = createAxiosError(0, {}, 'ERR_NETWORK');

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe(
      'Unable to connect to the server. Please check your network connection.',
    );
  });

  it('should return error message for Axios error with unknown status', () => {
    const axiosError = createAxiosError(418, {});

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe('Request failed');
  });

  it('should return Error message for standard Error objects', () => {
    const error = new Error('Standard error message');

    expect(extractErrorMessage(error)).toBe('Standard error message');
  });

  it('should return string errors as-is', () => {
    expect(extractErrorMessage('String error message')).toBe('String error message');
  });

  it('should return default message for unknown error types', () => {
    expect(extractErrorMessage({ unknown: 'object' })).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });
});

describe('extractValidationErrors', () => {
  it('should return validation errors when present', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '422',
        message: 'Validation failed',
        cause: {
          // eslint-disable-next-line camelcase
          validation_errors: [
            { type: FieldErrorType.ErrorTypeRequired, field: 'name', message: 'Name is required' },
            { type: FieldErrorType.ErrorTypeInvalid, field: 'email', message: 'Invalid email' },
          ],
        },
      },
    };

    const errors = extractValidationErrors(envelope) ?? [];
    expect(errors).toHaveLength(2);
    expect(errors[0].field).toBe('name');
    expect(errors[1].field).toBe('email');
  });

  it('should return undefined when no validation errors', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(extractValidationErrors(envelope)).toBeUndefined();
  });

  it('should return undefined when cause exists but no validation errors', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [{ message: 'Resource exists' }],
        },
      },
    };

    expect(extractValidationErrors(envelope)).toBeUndefined();
  });
});

describe('extractConflictCauses', () => {
  it('should return conflict causes when present', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [{ message: 'Resource already exists' }, { message: 'Name is taken' }],
        },
      },
    };

    const causes = extractConflictCauses(envelope) ?? [];
    expect(causes).toHaveLength(2);
    expect(causes[0].message).toBe('Resource already exists');
    expect(causes[1].message).toBe('Name is taken');
  });

  it('should return undefined when no conflict causes', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(extractConflictCauses(envelope)).toBeUndefined();
  });

  it('should return undefined when cause exists but no conflict causes', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '422',
        message: 'Validation failed',
        cause: {
          // eslint-disable-next-line camelcase
          validation_errors: [
            { type: FieldErrorType.ErrorTypeRequired, field: 'name', message: 'Name is required' },
          ],
        },
      },
    };

    expect(extractConflictCauses(envelope)).toBeUndefined();
  });
});

describe('formatValidationErrorMessages', () => {
  it('should format validation errors with message and field', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '422',
        message: 'Validation failed',
        cause: {
          // eslint-disable-next-line camelcase
          validation_errors: [
            { type: FieldErrorType.ErrorTypeRequired, field: 'name', message: 'Name is required' },
            { type: FieldErrorType.ErrorTypeInvalid, field: 'email', message: 'Invalid email' },
            { type: FieldErrorType.ErrorTypeInvalid, message: 'Unknown field' },
          ],
        },
      },
    };

    expect(formatValidationErrorMessages(envelope)).toEqual([
      'Name is required: name',
      'Invalid email: email',
      'Unknown field',
    ]);
  });

  it('should return empty array when no validation errors', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(formatValidationErrorMessages(envelope)).toEqual([]);
  });
});

describe('formatConflictErrorMessages', () => {
  it('should format conflict errors with message and origin', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [
            { message: 'Resource exists', origin: ApiErrorCauseOrigin.OriginKubernetes },
            { message: 'Name taken' },
          ],
        },
      },
    };

    expect(formatConflictErrorMessages(envelope)).toEqual([
      'Resource exists (KUBERNETES)',
      'Name taken',
    ]);
  });

  it('should return empty array when no conflict causes', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(formatConflictErrorMessages(envelope)).toEqual([]);
  });
});
