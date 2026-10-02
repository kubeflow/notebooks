import { DeploymentMode, asEnumMember } from 'mod-arch-core';
import { Theme } from 'mod-arch-kubeflow';

declare global {
  interface Window {
    _env_?: {
      DEPLOYMENT_MODE?: string;
      [key: string]: string | undefined;
    };
  }
}

export const STYLE_THEME = asEnumMember(process.env.STYLE_THEME, Theme) || Theme.MUI;
// Uses container runtime injection (window._env_) for deployments, falling back to build-time vars (process.env) for dev/tests.
export const DEPLOYMENT_MODE =
  asEnumMember(window._env_?.DEPLOYMENT_MODE, DeploymentMode) ||
  asEnumMember(process.env.DEPLOYMENT_MODE, DeploymentMode) ||
  DeploymentMode.Kubeflow;
export const DEV_MODE = process.env.APP_ENV === 'development';
export const POLL_INTERVAL = process.env.POLL_INTERVAL
  ? parseInt(process.env.POLL_INTERVAL)
  : 30000;
export const KUBEFLOW_USERNAME = process.env.KUBEFLOW_USERNAME || 'user@example.com';
export const IMAGE_DIR = process.env.IMAGE_DIR || 'images';
export const ROUTES_PREFIX = process.env.ROUTES_PREFIX ?? '';
export const URL_PREFIX = process.env.URL_PREFIX ?? '/workspaces';
export const BFF_API_VERSION = 'v1';
export const MANDATORY_NAMESPACE = process.env.MANDATORY_NAMESPACE || undefined;
export const COMPANY_URI = process.env.COMPANY_URI || 'oci://kubeflow.io';
export const WORKSPACE_KIND_EXAMPLES_URL =
  process.env.WORKSPACE_KIND_EXAMPLES_URL ||
  'https://github.com/kubeflow/notebooks/wiki/WorkspaceKinds';
export const MOCK_API_ENABLED = process.env.MOCK_API_ENABLED === 'true';
/** Set HIDE_PRE_GA_BANNER=true to hide the pre-GA banner; shown by default. */
export const HIDE_PRE_GA_BANNER = process.env.HIDE_PRE_GA_BANNER === 'true';
/** Learn more link in the pre-GA banner; default kubeflow.org. */
export const PRE_GA_LEARN_MORE_LINK =
  process.env.PRE_GA_LEARN_MORE_LINK ||
  'https://www.kubeflow.org/docs/components/notebooks/notebooks-v2-pre-ga-banner';

export const CONTENT_TYPE_KEY = 'Content-Type';
