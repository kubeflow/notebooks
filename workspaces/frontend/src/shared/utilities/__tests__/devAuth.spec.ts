import axios from 'axios';
import {
  DEV_AUTH_USER_KEY,
  DEV_AUTH_GROUPS_KEY,
  registerDevAuthInterceptor,
} from '~/shared/utilities/devAuth';

describe('devAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('registerDevAuthInterceptor', () => {
    // Access the interceptor handler directly via the internal handlers array.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getInterceptorFn = (instance: ReturnType<typeof axios.create>): ((config: any) => any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance.interceptors.request as any).handlers[0].fulfilled;

    it('should use default user when localStorage is empty', () => {
      const instance = axios.create();
      registerDevAuthInterceptor(instance);

      const config = getInterceptorFn(instance)({
        headers: new axios.AxiosHeaders(),
      });

      expect(config.headers['kubeflow-userid']).toBe('admin');
      expect(config.headers['kubeflow-groups']).toBeUndefined();
    });

    it('should set kubeflow-userid header when user is non-empty', () => {
      localStorage.setItem(DEV_AUTH_USER_KEY, 'dev-user');
      const instance = axios.create();
      registerDevAuthInterceptor(instance);

      const config = getInterceptorFn(instance)({
        headers: new axios.AxiosHeaders(),
      });

      expect(config.headers['kubeflow-userid']).toBe('dev-user');
      expect(config.headers['kubeflow-groups']).toBeUndefined();
    });

    it('should set kubeflow-groups header when groups is non-empty', () => {
      localStorage.setItem(DEV_AUTH_USER_KEY, '');
      localStorage.setItem(DEV_AUTH_GROUPS_KEY, 'editors,viewers');
      const instance = axios.create();
      registerDevAuthInterceptor(instance);

      const config = getInterceptorFn(instance)({
        headers: new axios.AxiosHeaders(),
      });

      expect(config.headers['kubeflow-userid']).toBeUndefined();
      expect(config.headers['kubeflow-groups']).toBe('editors,viewers');
    });

    it('should set both headers when both are non-empty', () => {
      localStorage.setItem(DEV_AUTH_USER_KEY, 'dev-user');
      localStorage.setItem(DEV_AUTH_GROUPS_KEY, 'editors,viewers');
      const instance = axios.create();
      registerDevAuthInterceptor(instance);

      const config = getInterceptorFn(instance)({
        headers: new axios.AxiosHeaders(),
      });

      expect(config.headers['kubeflow-userid']).toBe('dev-user');
      expect(config.headers['kubeflow-groups']).toBe('editors,viewers');
    });

    it('should not set headers when values are empty or whitespace', () => {
      localStorage.setItem(DEV_AUTH_USER_KEY, '  ');
      localStorage.setItem(DEV_AUTH_GROUPS_KEY, '  ');
      const instance = axios.create();
      registerDevAuthInterceptor(instance);

      const config = getInterceptorFn(instance)({
        headers: new axios.AxiosHeaders(),
      });

      expect(config.headers['kubeflow-userid']).toBeUndefined();
      expect(config.headers['kubeflow-groups']).toBeUndefined();
    });

    it('should trim whitespace from values', () => {
      localStorage.setItem(DEV_AUTH_USER_KEY, '  padded-user  ');
      localStorage.setItem(DEV_AUTH_GROUPS_KEY, '  grp1 , grp2  ');
      const instance = axios.create();
      registerDevAuthInterceptor(instance);

      const config = getInterceptorFn(instance)({
        headers: new axios.AxiosHeaders(),
      });

      expect(config.headers['kubeflow-userid']).toBe('padded-user');
      expect(config.headers['kubeflow-groups']).toBe('grp1 , grp2');
    });
  });
});
