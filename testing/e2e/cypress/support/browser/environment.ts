// Browser only (specs, pages, models). See README "Architecture".
import type { E2eEnvironment } from '../shared/environment';

function load(): E2eEnvironment {
  const env = Cypress.env('e2e') as E2eEnvironment | undefined;
  if (!env) {
    throw new Error(
      'Cypress.env("e2e") is not set. It is published by setupPlugins() in ' +
        'cypress/support/plugin/index.ts; make sure cypress.config.ts calls it.',
    );
  }
  return env;
}

/**
 * Where and as whom the suite runs (namespace, identities, baseline objects).
 * Read values from here instead of hardcoding them. Every value can be
 * overridden by environment variable; see README "Configuration".
 */
export const environment: E2eEnvironment = load();
