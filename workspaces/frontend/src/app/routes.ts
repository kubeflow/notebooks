export const AppRoutePaths = {
  root: '/',
  workspaces: '/workspaces',
  workspaceCreate: '/workspaces/create',
  workspaceEdit: '/workspaces/edit',
  workspaceKinds: '/workspacekinds',
} satisfies Record<string, `/${string}`>;

export type AppRoute = (typeof AppRoutePaths)[keyof typeof AppRoutePaths];
export type AppRouteKey = keyof typeof AppRoutePaths;

/**
 * Maps each route to the parameters it expects in the URL path.
 * `undefined` indicates no params are expected.
 *
 * @example
 * // For a route like '/my/route/:myRouteParam':
 * export const routeParamsDefinition = {
 *   myRoute: { myRouteParam: string };
 * }
 */
export const routeParamsDefinition = {
  root: undefined,
  workspaces: undefined,
  workspaceCreate: undefined,
  workspaceEdit: undefined,
  workspaceKinds: undefined,
} satisfies Record<AppRouteKey, object | undefined>;

/**
 * Maps each route to the shape of its optional navigation state.
 * `undefined` indicates no state is expected.
 *
 * @example
 * // For a route like '/my/route' with myRouteParam in the state:
 * export const routeStateDefinition = {
 *   myRoute: { myRouteParam: string };
 * }
 */
export const routeStateDefinition = {
  root: undefined,
  workspaces: undefined,
  workspaceCreate: {
    namespace: '',
  },
  workspaceEdit: {
    namespace: '',
    workspaceName: '',
  },
  workspaceKinds: undefined,
} satisfies Record<AppRouteKey, object | undefined>;

/**
 * Maps each route to its allowed search (query string) parameters.
 * `undefined` indicates no search params are expected.
 *
 * @example
 * // For a route like '/my/route?mySearchParam=foo':
 * export const routeSearchDefinition = {
 *   myRoute: { mySearchParam: string };
 * }
 */
export const routeSearchDefinition = {
  root: undefined,
  workspaces: undefined,
  workspaceCreate: undefined,
  workspaceEdit: undefined,
  workspaceKinds: undefined,
} satisfies Record<AppRouteKey, object | undefined>;
