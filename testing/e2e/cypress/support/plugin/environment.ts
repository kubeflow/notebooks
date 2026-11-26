// Node.js process only (see README "Architecture").
import { resolveEnvironment } from '../shared/environment';

/** The plugin-side environment. Published to the browser as `Cypress.env('e2e')` in `plugin/index.ts`. */
export const environment = resolveEnvironment(process.env);
