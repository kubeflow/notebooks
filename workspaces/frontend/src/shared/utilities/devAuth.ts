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

// Reads raw localStorage values written by useBrowserStorage (non-JSON mode)
// in DebugAuthSection — the two must share the same keys and storage format.
export const registerDevAuthInterceptor = (axiosInstance: AxiosInstance): void => {
  axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const user = getDevAuthUser().trim();
    const groups = getDevAuthGroups().trim();

    if (user) {
      config.headers.set(USERID_HEADER, user);
    }
    if (groups) {
      config.headers.set(GROUPS_HEADER, groups);
    }

    return config;
  });
};
