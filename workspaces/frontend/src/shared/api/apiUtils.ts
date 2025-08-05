import axios from 'axios';
import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { ApiCallResult } from '~/shared/api/types';

function isApiErrorEnvelope(data: unknown): data is ApiErrorEnvelope {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return false;
  }

  const { error } = data as { error: unknown };

  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false;
  }

  const { message } = error as { message?: unknown };

  return typeof message === 'string';
}

export async function safeApiCall<T>(fn: () => Promise<T>): Promise<ApiCallResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error: unknown) {
    if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
      const apiError = error.response?.data;
      if (apiError && isApiErrorEnvelope(apiError)) {
        return { ok: false, errorEnvelope: apiError };
      }
    }
    throw error;
  }
}
