import { asEnumMember } from '~/shared/typeHelpers';
import { DeploymentMode, Theme } from '~/shared/utilities/types';

export const STYLE_THEME = asEnumMember(process.env.STYLE_THEME, Theme) || Theme.MUI;
export const DEPLOYMENT_MODE =
  asEnumMember(process.env.DEPLOYMENT_MODE, DeploymentMode) || DeploymentMode.Kubeflow;
export const DEV_MODE = process.env.APP_ENV === 'development';
export const POLL_INTERVAL = process.env.POLL_INTERVAL
  ? parseInt(process.env.POLL_INTERVAL)
  : 30000;
export const LOGO_LIGHT = process.env.LOGO || 'logo-light-theme.svg';
export const URL_PREFIX = process.env.URL_PREFIX ?? '/workspaces';
export const BFF_API_PREFIX = process.env.BFF_API_PREFIX ?? '/';
export const BFF_API_VERSION = 'v1';
export const MOCK_API_ENABLED = process.env.MOCK_API_ENABLED === 'true';

export const CONTENT_TYPE_KEY = 'Content-Type';

export const isMUITheme = (): boolean => STYLE_THEME === Theme.MUI;
