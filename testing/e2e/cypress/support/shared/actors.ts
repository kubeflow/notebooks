// Context-agnostic: imported by browser code, plugin code, and scripts/.

/**
 * The simulated users a spec can run as. The `actor` folder of a spec path
 * (`tests/<area>/<actor>/<name>.cy.ts`) must be one of these; it decides the
 * identity the spec is logged in as. Adding an actor means adding it here,
 * giving it an identity in `environment.ts`, and RBAC in `plugin/baseline.ts`.
 */
export const ACTORS = ['admin', 'user'] as const;

export type Actor = (typeof ACTORS)[number];

export function isActor(value: string): value is Actor {
  return (ACTORS as readonly string[]).includes(value);
}
