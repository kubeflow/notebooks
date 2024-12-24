const DEV_MODE = process.env.APP_ENV === 'development';
const AUTH_HEADER = process.env.AUTH_HEADER || 'kubeflow-userid';

export { DEV_MODE, AUTH_HEADER };
