// Context-agnostic: imported by browser code (via browser/environment.ts) and plugin code
// (via plugin/environment.ts). Never read `process.env` here; Cypress's browser bundle shims
// it to `{}`, so overrides would silently be ignored in specs.
// TODO: add Node unit tests (node --test) as the framework grows.
import type { Actor } from './actors';

/**
 * Single source of truth for where and as whom the suite runs. Specs, pages,
 * and models read it via `environment` (browser); setup tasks via the plugin
 * copy. Both are resolved by `resolveEnvironment()` from the same variables.
 */
export interface E2eEnvironment {
  baseUrl: string;
  /** Namespace that namespaced test resources are created in by default. */
  namespace: string;
  /** The `kubeflow-userid` each actor is simulated as. */
  identities: Record<Actor, string>;
  /** Kube contexts setup is allowed to run against (`*` wildcard supported). */
  allowedContexts: string[];
  /** Delete baseline objects after the run. Off by default for fast reruns. */
  teardown: boolean;
  /** Global objects that every spec can rely on; created once per run. */
  baseline: {
    /** WorkspaceKind name; also selects the controller sample `<name>_v1beta1_workspacekind.yaml`. */
    workspaceKind: string;
    /** imageConfig option id in the baseline WorkspaceKind, used by default. */
    imageConfig: string;
    /** podConfig option id in the baseline WorkspaceKind, used by default. */
    podConfig: string;
  };
}

/** Every variable `resolveEnvironment()` reads, with its default. Documented in README.md. */
export const ENVIRONMENT_DEFAULTS = {
  CYPRESS_BASE_URL: 'https://localhost:8443/workspaces',
  E2E_NAMESPACE: 'e2e-test',
  E2E_ADMIN_USER: 'admin@e2e.test',
  E2E_USER: 'user@e2e.test',
  E2E_ALLOWED_CONTEXTS: 'kind-local-e2e',
  E2E_TEARDOWN: 'false',
  E2E_BASELINE_WORKSPACE_KIND: 'jupyterlab',
  E2E_BASELINE_IMAGE_CONFIG: 'jupyter-scipy:v1.11.1',
  E2E_BASELINE_POD_CONFIG: 'tiny_cpu',
} as const;

export type EnvironmentVariable = keyof typeof ENVIRONMENT_DEFAULTS;

export function resolveEnvironment(vars: Record<string, string | undefined>): E2eEnvironment {
  const get = (key: EnvironmentVariable): string => vars[key] || ENVIRONMENT_DEFAULTS[key];

  return {
    baseUrl: get('CYPRESS_BASE_URL').replace(/\/+$/, ''),
    namespace: get('E2E_NAMESPACE'),
    identities: {
      admin: get('E2E_ADMIN_USER'),
      user: get('E2E_USER'),
    },
    allowedContexts: get('E2E_ALLOWED_CONTEXTS')
      .split(',')
      .map((context) => context.trim())
      .filter(Boolean),
    teardown: get('E2E_TEARDOWN') === 'true',
    baseline: {
      workspaceKind: get('E2E_BASELINE_WORKSPACE_KIND'),
      imageConfig: get('E2E_BASELINE_IMAGE_CONFIG'),
      podConfig: get('E2E_BASELINE_POD_CONFIG'),
    },
  };
}
