import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

export const DEV_AUTH_USER_KEY = 'kubeflow-dev-auth-user';
export const DEV_AUTH_GROUPS_KEY = 'kubeflow-dev-auth-groups';

const USERID_HEADER = 'kubeflow-userid';
const GROUPS_HEADER = 'kubeflow-groups';

const DEFAULT_USER = 'admin';

const getDevAuthUser = (): string => {
  try {
    return localStorage.getItem(DEV_AUTH_USER_KEY) ?? DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
};

const getDevAuthGroups = (): string => {
  try {
    return localStorage.getItem(DEV_AUTH_GROUPS_KEY) ?? '';
  } catch {
    return '';
  }
};

// getDevAuthHeaders returns the dev-mode auth headers (kubeflow-userid/groups)
// as a plain object, for callers that cannot use the axios interceptor — e.g.
// the Server-Sent Events client, which sets headers on a fetch request directly.
export const getDevAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const user = getDevAuthUser().trim();
  const groups = getDevAuthGroups().trim();

  if (user) {
    headers[USERID_HEADER] = user;
  }
  if (groups) {
    headers[GROUPS_HEADER] = groups;
  }

  return headers;
};

// Reads raw localStorage values written by useBrowserStorage (non-JSON mode)
// in DebugAuthSection — the two must share the same keys and storage format.
export const registerDevAuthInterceptor = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const headers = getDevAuthHeaders();

    Object.entries(headers).forEach(([key, value]) => {
      config.headers.set(key, value);
    });

    return config;
  });
};
