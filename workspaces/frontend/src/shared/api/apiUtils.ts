import { ErrorEnvelope } from '~/shared/api/backendApiTypes';
import { handleRestFailures } from '~/shared/api/errorUtils';
import { APIOptions, ResponseBody } from '~/shared/api/types';
import { EitherOrNone } from '~/shared/typeHelpers';
import { AUTH_HEADER, DEV_MODE } from '~/shared/utilities/const';

export const mergeRequestInit = (
  opts: APIOptions = {},
  specificOpts: RequestInit = {},
): RequestInit => ({
  ...specificOpts,
  ...(opts.signal && { signal: opts.signal }),
  headers: {
    ...(opts.headers ?? {}),
    ...(specificOpts.headers ?? {}),
  },
});

type CallRestJSONOptions = {
  queryParams?: Record<string, unknown>;
  parseJSON?: boolean;
} & EitherOrNone<
  {
    fileContents: string;
  },
  {
    data: Record<string, unknown>;
  }
>;

const callRestJSON = <T>(
  host: string,
  path: string,
  requestInit: RequestInit,
  { data, fileContents, queryParams, parseJSON = true }: CallRestJSONOptions,
): Promise<T> => {
  const { method, ...otherOptions } = requestInit;

  const sanitizedQueryParams = queryParams
    ? Object.entries(queryParams).reduce((acc, [key, value]) => {
        if (value) {
          return { ...acc, [key]: value };
        }

        return acc;
      }, {})
    : null;

  const searchParams = sanitizedQueryParams
    ? new URLSearchParams(sanitizedQueryParams).toString()
    : null;

  let requestData: string | undefined;
  let contentType: string | undefined;
  let formData: FormData | undefined;
  if (fileContents) {
    formData = new FormData();
    formData.append(
      'uploadfile',
      new Blob([fileContents], { type: 'application/x-yaml' }),
      'uploadedFile.yml',
    );
  } else if (data) {
    // It's OK for contentType and requestData to BOTH be undefined for e.g. a GET request or POST with no body.
    contentType = 'application/json;charset=UTF-8';
    requestData = JSON.stringify(data);
  }

  return fetch(`${host}${path}${searchParams ? `?${searchParams}` : ''}`, {
    ...otherOptions,
    headers: {
      ...otherOptions.headers,
      ...(DEV_MODE && { [AUTH_HEADER]: localStorage.getItem(AUTH_HEADER) }),
      ...(contentType && { 'Content-Type': contentType }),
    },
    method,
    body: formData ?? requestData,
  }).then((response) =>
    response.text().then((fetchedData) => {
      if (parseJSON) {
        return JSON.parse(fetchedData);
      }
      return fetchedData;
    }),
  );
};

export const restGET = <T>(
  host: string,
  path: string,
  queryParams: Record<string, unknown> = {},
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'GET' }), {
    queryParams,
    parseJSON: options?.parseJSON,
  });

/** Standard POST */
export const restCREATE = <T>(
  host: string,
  path: string,
  data: Record<string, unknown>,
  queryParams: Record<string, unknown> = {},
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'POST' }), {
    data,
    queryParams,
    parseJSON: options?.parseJSON,
  });

/** POST -- but with file content instead of body data */
export const restFILE = <T>(
  host: string,
  path: string,
  fileContents: string,
  queryParams: Record<string, unknown> = {},
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'POST' }), {
    fileContents,
    queryParams,
    parseJSON: options?.parseJSON,
  });

/** POST -- but no body data -- targets simple endpoints */
export const restENDPOINT = <T>(
  host: string,
  path: string,
  queryParams: Record<string, unknown> = {},
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'POST' }), {
    queryParams,
    parseJSON: options?.parseJSON,
  });

export const restUPDATE = <T>(
  host: string,
  path: string,
  data: Record<string, unknown>,
  queryParams: Record<string, unknown> = {},
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'PUT' }), {
    data,
    queryParams,
    parseJSON: options?.parseJSON,
  });

export const restPATCH = <T>(
  host: string,
  path: string,
  data: Record<string, unknown>,
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'PATCH' }), {
    data,
    parseJSON: options?.parseJSON,
  });

export const restDELETE = <T>(
  host: string,
  path: string,
  data: Record<string, unknown>,
  queryParams: Record<string, unknown> = {},
  options?: APIOptions,
): Promise<T> =>
  callRestJSON<T>(host, path, mergeRequestInit(options, { method: 'DELETE' }), {
    data,
    queryParams,
    parseJSON: options?.parseJSON,
  });

/** POST -- but with YAML content directly in body */
export const restYAML = <T>(
  host: string,
  path: string,
  yamlContent: string,
  queryParams?: Record<string, unknown>,
  options?: APIOptions,
): Promise<T> => {
  const { method, ...otherOptions } = mergeRequestInit(options, { method: 'POST' });

  const sanitizedQueryParams = queryParams
    ? Object.entries(queryParams).reduce((acc, [key, value]) => {
        if (value) {
          return { ...acc, [key]: value };
        }
        return acc;
      }, {})
    : null;

  const searchParams = sanitizedQueryParams
    ? new URLSearchParams(sanitizedQueryParams).toString()
    : null;

  return fetch(`${host}${path}${searchParams ? `?${searchParams}` : ''}`, {
    ...otherOptions,
    headers: {
      ...otherOptions.headers,
      ...(DEV_MODE && { [AUTH_HEADER]: localStorage.getItem(AUTH_HEADER) }),
      'Content-Type': 'application/vnd.kubeflow-notebooks.manifest+yaml',
    },
    method,
    body: yamlContent,
  }).then((response) =>
    response.text().then((fetchedData) => {
      if (options?.parseJSON !== false) {
        return JSON.parse(fetchedData);
      }
      return fetchedData;
    }),
  );
};

export const isNotebookResponse = <T>(response: unknown): response is ResponseBody<T> => {
  if (typeof response === 'object' && response !== null) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const notebookBody = response as { data?: T };
    return notebookBody.data !== undefined;
  }
  return false;
};

export const isErrorEnvelope = (e: unknown): e is ErrorEnvelope =>
  typeof e === 'object' &&
  e !== null &&
  'error' in e &&
  typeof (e as Record<string, unknown>).error === 'object' &&
  (e as { error: unknown }).error !== null &&
  typeof (e as { error: { message: unknown } }).error.message === 'string';

export function extractNotebookResponse<T>(response: unknown): T {
  if (isNotebookResponse<T>(response)) {
    return response.data;
  }
  throw new Error('Invalid response format');
}

export function extractErrorEnvelope(error: unknown): ErrorEnvelope {
  if (isErrorEnvelope(error)) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unexpected error';

  return {
    error: {
      message,
      code: 'UNKNOWN_ERROR',
    },
  };
}

export async function wrapRequest<T>(promise: Promise<T>, extractData = true): Promise<T> {
  try {
    const res = await handleRestFailures<T>(promise);
    return extractData ? extractNotebookResponse<T>(res) : res;
  } catch (error) {
    throw new ErrorEnvelopeException(extractErrorEnvelope(error));
  }
}

export class ErrorEnvelopeException extends Error {
  constructor(public envelope: ErrorEnvelope) {
    super(envelope.error?.message ?? 'Unknown error');
  }
}
