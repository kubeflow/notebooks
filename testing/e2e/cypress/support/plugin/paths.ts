import * as path from 'path';

// Node.js process only: resolves filesystem paths via `__dirname`, which Cypress rewrites to `/`
// when bundling code for the browser. Only import this from plugin/* (registered Cypress tasks)
// or cypress.config.ts — never from specs, page objects, or models.

// Repository root, resolved relative to this file (testing/e2e/cypress/support/plugin/paths.ts)
// via three known hops: testing/e2e/cypress/support/plugin -> testing/e2e -> testing -> repo
// root. Kept as named hops rather than a generic ".git" directory walk, which would add
// complexity for a path that is only ever resolved from this one, fixed location in the repo.
const SUPPORT_ROOT = path.resolve(__dirname, '..');
const E2E_ROOT = path.resolve(SUPPORT_ROOT, '..', '..');
const TESTING_ROOT = path.resolve(E2E_ROOT, '..');
const REPO_ROOT = path.resolve(TESTING_ROOT, '..');

const CONTROLLER_SAMPLES_DIR = path.join(
  REPO_ROOT,
  'workspaces/controller/manifests/kustomize/samples',
);

/** Absolute path to a controller sample WorkspaceKind YAML, e.g. `jupyterlab_v1beta1_workspacekind.yaml`. */
export function controllerSampleYaml(fileName: string): string {
  return path.join(CONTROLLER_SAMPLES_DIR, fileName);
}
