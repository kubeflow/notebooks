import { DeploymentMode, asEnumMember } from 'mod-arch-core';
import { Theme } from 'mod-arch-kubeflow';

export const STYLE_THEME = asEnumMember(process.env.STYLE_THEME, Theme) || Theme.MUI;
export const DEPLOYMENT_MODE =
  asEnumMember(process.env.DEPLOYMENT_MODE, DeploymentMode) || DeploymentMode.Kubeflow;
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
  'https://github.com/kubeflow/notebooks/tree/notebooks-v2/workspaces/controller/manifests/kustomize/samples';
export const MOCK_API_ENABLED = process.env.MOCK_API_ENABLED === 'true';
export const SHOW_PRE_GA_BANNER = process.env.SHOW_PRE_GA_BANNER === 'true';

export const CONTENT_TYPE_KEY = 'Content-Type';
