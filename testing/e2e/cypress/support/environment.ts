/**
 * Single source of truth for the e2e environment: the test namespace, the
 * identities used to simulate login, and the baseline fixtures that
 * `setupE2e()` provisions before any spec runs. Centralizing these here means
 * specs, page objects, and setup tasks never redeclare or drift on these
 * values independently.
 *
 * Every value can be overridden via environment variable, so the same test
 * suite can run against differently-provisioned environments (kind, Tilt,
 * etc.) without code changes.
 *
 * Safe to import from both the browser (specs, page objects) and the Cypress
 * Node.js plugin process (cypress.config.ts) — unlike `support/plugin/paths.ts`,
 * nothing here touches the filesystem or `__dirname`.
 */
export const environment = {
  baseUrl: process.env.CYPRESS_BASE_URL ?? 'https://localhost:8443/workspaces',
  namespace: process.env.E2E_NAMESPACE ?? 'e2e-test',
  identities: {
    admin: process.env.E2E_ADMIN_USER ?? 'admin@e2e.test',
    user: process.env.E2E_USER ?? 'user@e2e.test',
  },
  baselineWorkspaceKind: process.env.E2E_BASELINE_WORKSPACE_KIND ?? 'jupyterlab',
  baselinePvc: process.env.E2E_BASELINE_PVC ?? 'home-volume',
};
