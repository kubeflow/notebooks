import axios, { AxiosError, AxiosHeaders } from 'axios';
import {
  safeApiCall,
  extractErrorMessage,
  extractErrorEnvelopeMessage,
  extractValidationErrors,
  extractConflictCauses,
} from '~/shared/api/apiUtils';
import { ApiErrorEnvelope, FieldErrorType } from '~/generated/data-contracts';

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
      error: { message: 'Custom API error message' },
    });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe('Custom API error message');
  });

  it('should show single conflict cause instead of main error message', () => {
    const axiosError = createAxiosError(409, {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [{ message: 'Resource already exists' }],
        },
      },
    });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe('Resource already exists');
  });

  it('should show multiple conflict causes instead of main error message', () => {
    const axiosError = createAxiosError(409, {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [
            { message: 'Resource already exists' },
            { message: 'Name is already taken' },
          ],
        },
      },
    });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe(
      '• Resource already exists\n• Name is already taken',
    );
  });

  it('should ignore conflict causes with empty messages', () => {
    const axiosError = createAxiosError(409, {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [{ message: '' }, { message: 'Valid message' }],
        },
      },
    });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe('Valid message');
  });

  it('should return base message when conflict causes array is empty', () => {
    const axiosError = createAxiosError(409, {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [],
        },
      },
    });

    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    expect(extractErrorMessage(axiosError)).toBe('Conflict occurred');
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

describe('extractErrorEnvelopeMessage', () => {
  it('should return error message when no conflict causes', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(extractErrorEnvelopeMessage(envelope)).toBe('Bad request');
  });

  it('should return single conflict cause instead of main message', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [{ message: 'Resource already exists' }],
        },
      },
    };

    expect(extractErrorEnvelopeMessage(envelope)).toBe('Resource already exists');
  });

  it('should return multiple conflict causes as bulleted list', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [
            { message: 'Resource already exists' },
            { message: 'Name is already taken' },
          ],
        },
      },
    };

    expect(extractErrorEnvelopeMessage(envelope)).toBe(
      '• Resource already exists\n• Name is already taken',
    );
  });

  it('should fall back to main message when conflict causes have no messages', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [{ message: '' }, {}],
        },
      },
    };

    expect(extractErrorEnvelopeMessage(envelope)).toBe('Conflict occurred');
  });

  it('should fall back to main message when conflict causes array is empty', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '409',
        message: 'Conflict occurred',
        cause: {
          // eslint-disable-next-line camelcase
          conflict_cause: [],
        },
      },
    };

    expect(extractErrorEnvelopeMessage(envelope)).toBe('Conflict occurred');
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

    const errors = extractValidationErrors(envelope);
    expect(errors).toHaveLength(2);
    expect(errors[0].field).toBe('name');
    expect(errors[1].field).toBe('email');
  });

  it('should return empty array when no validation errors', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(extractValidationErrors(envelope)).toEqual([]);
  });

  it('should return empty array when cause exists but no validation errors', () => {
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

    expect(extractValidationErrors(envelope)).toEqual([]);
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

    const causes = extractConflictCauses(envelope);
    expect(causes).toHaveLength(2);
    expect(causes[0].message).toBe('Resource already exists');
    expect(causes[1].message).toBe('Name is taken');
  });

  it('should return empty array when no conflict causes', () => {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: '400',
        message: 'Bad request',
      },
    };

    expect(extractConflictCauses(envelope)).toEqual([]);
  });

  it('should return empty array when cause exists but no conflict causes', () => {
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

    expect(extractConflictCauses(envelope)).toEqual([]);
  });
});
