// Context-agnostic: imported by browser code (support/e2e.ts) and scripts/check-spec-paths.ts.
// TODO: add Node unit tests (node --test) as the framework grows.
import { ACTORS, type Actor, isActor } from './actors';

export interface SpecPath {
  area: string;
  actor: Actor;
  name: string;
}

const SEGMENT = /^[a-z][a-zA-Z0-9-]*$/;
const EXPECTED = 'cypress/tests/<area>/<actor>/<name>.cy.ts';

/**
 * Parses a spec path (relative to `testing/e2e`) per the
 * `tests/<area>/<actor>/<name>.cy.ts` convention. Returns an error message
 * instead of throwing so callers can aggregate (lint) or fail fast (runtime).
 */
export function parseSpecPath(relativePath: string): SpecPath | { error: string } {
  const normalized = relativePath.replace(/\\/g, '/');
  const match = /(?:^|\/)cypress\/tests\/(.+)\.cy\.ts$/.exec(normalized);
  if (!match) {
    return { error: `"${relativePath}" is not a spec under cypress/tests/ (expected ${EXPECTED})` };
  }

  const segments = match[1].split('/');
  if (segments.length !== 3) {
    return {
      error: `"${relativePath}" must be exactly ${EXPECTED} (got ${segments.length} segment(s))`,
    };
  }

  const [area, actor, name] = segments;
  if (!isActor(actor)) {
    return {
      error:
        `"${relativePath}": actor folder "${actor}" must be one of: ${ACTORS.join(', ')}. ` +
        'To add an actor, see cypress/support/shared/actors.ts.',
    };
  }

  const bad = [area, name].filter((segment) => !SEGMENT.test(segment));
  if (bad.length > 0) {
    return {
      error: `"${relativePath}": ${bad.map((s) => `"${s}"`).join(', ')} must be camelCase or kebab-case`,
    };
  }

  return { area, actor, name };
}
