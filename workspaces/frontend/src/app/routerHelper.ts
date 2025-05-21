import {
  generatePath,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  AppRouteKey,
  AppRoutePaths,
  routeParamsDefinition,
  routeSearchDefinition,
  routeStateDefinition,
} from '~/app/routes';

export type RouteParamsMap = typeof routeParamsDefinition;
export type RouteStateMap = typeof routeStateDefinition;
export type RouteSearchParamsMap = typeof routeSearchDefinition;

/**
 * Combines path params, search params, and state into a type-safe interface
 * for use with `useTypedNavigate()`.
 *
 * @example
 * navigate('myRoute', {
 *   params: { myRouteParam: 'foo' },
 *   state: { myStateParam: 'bar' },
 *   searchParams: { mySearchParam: 'baz' },
 * });
 */
type NavigateOptions<T extends AppRouteKey> = RouteParamsMap[T] extends undefined
  ? { state?: RouteStateMap[T]; searchParams?: RouteSearchParamsMap[T] }
  : { state?: RouteStateMap[T]; params: RouteParamsMap[T]; searchParams?: RouteSearchParamsMap[T] };

/**
 * Builds a path string using the route key and params.
 * Useful for generating links or programmatically navigating with params.
 *
 * @example
 * // Programmatic navigation
 * const path = buildPath('myRoute', { myRouteParam: 'foo' });
 * navigate(path);
 *
 * @example
 * // Usage inside a <Link>
 * <Link to={buildPath('myRoute', { myRouteParam: 'foo' })}>
 *   Go to my route
 * </Link>
 */
export function buildPath<T extends AppRouteKey>(to: T, params: RouteParamsMap[T]): string {
  return generatePath(AppRoutePaths[to], params as RouteParamsMap[T]);
}

/**
 * Converts a typed object into a query string (e.g., `?mySearchParam=foo`).
 *
 * @example
 * buildSearchParams({ mySearchParam: 'foo' })
 */
export function buildSearchParams<T extends AppRouteKey>(params: RouteSearchParamsMap[T]): string {
  if (typeof params !== 'object') {
    return '';
  }

  const filtered = Object.entries(params as unknown as Record<string, string | undefined>).filter(
    ([, v]) => v !== undefined,
  ) as [string, string][];

  const query = new URLSearchParams(filtered).toString();
  return query ? `?${query}` : '';
}

/**
 * Typed wrapper for `useParams()` based on the route key.
 *
 * @example
 * const { myParam } = useTypedParams<'myRoute'>();
 */
export function useTypedParams<T extends AppRouteKey>(): RouteParamsMap[T] {
  return useParams() as unknown as RouteParamsMap[T];
}

/**
 * Typed wrapper for `useLocation()` that includes route-specific state.
 *
 * @example
 * const location = useTypedLocation<'myRoute'>();
 * const { myParam } = location.state;
 */
export function useTypedLocation<T extends AppRouteKey>(): ReturnType<typeof useLocation> & {
  state: RouteStateMap[T];
} {
  const location = useLocation();
  return location as unknown as ReturnType<typeof useLocation> & {
    state: RouteStateMap[T];
  };
}

/**
 * Typed wrapper for `useNavigate()` that supports:
 * - Path params (when defined in RouteParamsMap)
 * - Query string (search) params (when defined in RouteSearchParamsMap)
 * - Location state (when defined in RouteStateMap)
 *
 * @example
 * // Navigate to a static route without state or search:
 * navigate('workspaces');
 *
 * @example
 * // Navigate with state only:
 * navigate('workspaceCreate', {
 *   state: { namespace: 'dev' },
 * });
 *
 * @example
 * // Navigate with query string only:
 * navigate('workspaceKinds', {
 *   searchParams: { filter: 'active' },
 * });
 *
 * @example
 * // Navigate with both params, search, and state:
 * navigate('workspaceEdit', {
 *   params: { workspaceId: 'abc123' },
 *   searchParams: { tab: 'settings' },
 *   state: {
 *     namespace: 'dev',
 *     workspaceName: 'my-workspace',
 *   },
 * });
 */
export function useTypedNavigate(): <T extends AppRouteKey>(
  to: T,
  options?: NavigateOptions<T>,
) => void {
  const navigate = useNavigate();

  return <T extends AppRouteKey>(to: T, options?: NavigateOptions<T>): void => {
    const pathTemplate = AppRoutePaths[to];
    const opts = (options ?? {}) as NavigateOptions<T>;

    const query = buildSearchParams(opts.searchParams as RouteSearchParamsMap[T]);

    const path =
      ('params' in opts
        ? generatePath(pathTemplate, opts.params as RouteParamsMap[T])
        : pathTemplate) + query;

    const state = 'state' in opts ? opts.state : undefined;
    navigate(path, state !== undefined ? { state } : undefined);
  };
}

/**
 * Typed wrapper for `useSearchParams()` based on the route key.
 *
 * @example
 * const { mySearchParam } = useTypedSearchParams<'myRoute'>();
 */
export function useTypedSearchParams<T extends AppRouteKey>(): RouteSearchParamsMap[T] {
  const [searchParams] = useSearchParams();

  const result: Record<string, string | undefined> = {};
  for (const [key, value] of searchParams.entries()) {
    result[key] = value;
  }

  return result as unknown as RouteSearchParamsMap[T];
}
