export const AppRoutePaths = {
  root: '/',
  workspaces: '/workspaces',
  workspaceCreate: '/workspaces/create',
  workspaceEdit: '/workspaces/edit',
  workspaceKinds: '/workspacekinds',
  workspaceKindSummary: '/workspacekinds/:kind/summary',
} satisfies Record<string, `/${string}`>;

export type AppRoute = (typeof AppRoutePaths)[keyof typeof AppRoutePaths];
export type AppRouteKey = keyof typeof AppRoutePaths;

/**
 * Maps each route to the parameters it expects in the URL path.
 * `undefined` indicates no params are expected.
 *
 * @example
 * // For a route like '/my/route/:myRouteParam':
 * export type RouteParamsMap = {
 *   myRoute: { myRouteParam: string };
 * }
 */
export type RouteParamsMap = {
  root: undefined;
  workspaces: undefined;
  workspaceCreate: undefined;
  workspaceEdit: undefined;
  workspaceKinds: undefined;
  workspaceKindSummary: {
    kind: string;
  };
};

/**
 * Maps each route to the shape of its optional navigation state.
 * `undefined` indicates no state is expected.
 *
 * @example
 * // For a route like '/my/route' with myRouteParam in the state:
 * export type RouteStateMap = {
 *   myRoute: { myRouteParam: string };
 * }
 */
export type RouteStateMap = {
  root: undefined;
  workspaces: undefined;
  workspaceCreate: {
    namespace: string;
  };
  workspaceEdit: {
    namespace: string;
    workspaceName: string;
  };
  workspaceKinds: undefined;
  workspaceKindSummary: {
    namespace?: string;
    imageId?: string;
    podConfigId?: string;
  };
};

/**
 * Maps each route to its allowed search (query string) parameters.
 * `undefined` indicates no search params are expected.
 *
 * @example
 * // For a route like '/my/route?mySearchParam=foo':
 * export type RouteSearchParamsMap = {
 *   myRoute: { mySearchParam: string };
 * }
 */
export type RouteSearchParamsMap = {
  root: undefined;
  workspaces: undefined;
  workspaceCreate: undefined;
  workspaceEdit: undefined;
  workspaceKinds: undefined;
  workspaceKindSummary: undefined;
};
