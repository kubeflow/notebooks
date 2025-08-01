export const DEV_MODE = process.env.APP_ENV === 'development';
export const AUTH_HEADER = process.env.AUTH_HEADER || 'kubeflow-userid';

export const CONTENT_TYPE_KEY = 'Content-Type';

export enum ContentType {
  YAML = 'application/yaml',
}
