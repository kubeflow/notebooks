import axios from 'axios';
import { ApiConflictError, ApiErrorEnvelope, ApiValidationError } from '~/generated/data-contracts';
import { ApiCallResult } from '~/shared/api/types';

// Standard error messages for HTTP status codes documented in the API
const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please review your inputs.',
  401: 'You are not authenticated. Please log in and try again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'A conflict occurred. The resource may already exist.',
  413: 'The request is too large.',
  415: 'Unsupported media type.',
  422: 'The request could not be processed. Please check your inputs.',
  500: 'An internal server error occurred. Please try again later.',
};

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
    const result = await fn();
    return { ok: true, result };
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

function formatConflictCauses(conflictCauses: ApiConflictError[]): string | null {
  const messages = conflictCauses
    .map((cause) => cause.message)
    .filter((message): message is string => Boolean(message));

  if (messages.length === 0) {
    return null;
  }

  if (messages.length === 1) {
    return messages[0];
  }

  return messages.map((msg) => `• ${msg}`).join('\n');
}

export function extractValidationErrors(errorEnvelope: ApiErrorEnvelope): ApiValidationError[] {
  return errorEnvelope.error.cause?.validation_errors ?? [];
}

export function extractConflictCauses(errorEnvelope: ApiErrorEnvelope): ApiConflictError[] {
  return errorEnvelope.error.cause?.conflict_cause ?? [];
}

export function extractErrorEnvelopeMessage(errorEnvelope: ApiErrorEnvelope): string {
  const conflictCauses = extractConflictCauses(errorEnvelope);
  if (conflictCauses.length > 0) {
    const conflictDetails = formatConflictCauses(conflictCauses);
    if (conflictDetails) {
      return conflictDetails;
    }
  }

  return errorEnvelope.error.message;
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const responseData = error.response?.data;

    if (responseData && isApiErrorEnvelope(responseData)) {
      return extractErrorEnvelopeMessage(responseData);
    }

    // Fall back to status-based message
    const status = error.response?.status;
    if (status && HTTP_STATUS_MESSAGES[status]) {
      return HTTP_STATUS_MESSAGES[status];
    }

    // Network error
    if (error.code === 'ERR_NETWORK') {
      return 'Unable to connect to the server. Please check your network connection.';
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}
