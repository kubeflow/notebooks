/* eslint-disable local-rules/no-raw-react-router-hook */

import {
  generatePath,
  Location,
  NavigateOptions as RRNavigateOptions,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  AppRouteKey,
  AppRoutePaths,
  RouteParamsMap,
  RouteSearchParamsMap,
  RouteStateMap,
} from '~/app/routes';

type OptionalRouteParams<T extends AppRouteKey> = RouteParamsMap[T] extends undefined
  ? object
  : { params: RouteParamsMap[T] };

type OptionalRouteState<T extends AppRouteKey> = RouteStateMap[T] extends undefined
  ? object
  : { state: RouteStateMap[T] };

type OptionalRouteSearchParams<T extends AppRouteKey> = RouteSearchParamsMap[T] extends undefined
  ? object
  : { searchParams: RouteSearchParamsMap[T] };

type CommonNavigateOptions = Pick<RRNavigateOptions, 'replace' | 'preventScrollReset' | 'relative'>;

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
type NavigateOptions<T extends AppRouteKey> = CommonNavigateOptions &
  OptionalRouteParams<T> &
  OptionalRouteState<T> &
  OptionalRouteSearchParams<T>;

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
 * Converts an unknown object into a record of string values.
 * This is a utility function to ensure that the object can be safely used as a query string.
 */
function toRecord(params: unknown): Record<string, string | undefined> {
  if (typeof params !== 'object' || !params) {
    return {};
  }
  return params as Record<string, string | undefined>;
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

  const filtered = Object.entries(toRecord(params)).filter(([, v]) => v !== undefined) as [
    string,
    string,
  ][];

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
 * const { state } = useTypedLocation<'myRoute'>();
 * const { myParam } = state || {};
 */
export function useTypedLocation<T extends AppRouteKey>(): Omit<Location, 'state'> & {
  state?: RouteStateMap[T];
} {
  const location = useLocation();
  return location as Omit<Location, 'state'> & {
    state?: RouteStateMap[T];
  };
}

export function useTypedNavigate(): {
  <T extends AppRouteKey>(to: T, options?: NavigateOptions<T>): void;
  (delta: number): void;
};

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
export function useTypedNavigate() {
  const navigate = useNavigate();

  return <T extends AppRouteKey>(toOrDelta: T | number, options?: NavigateOptions<T>): void => {
    if (typeof toOrDelta === 'number') {
      navigate(toOrDelta);
      return;
    }

    const to = toOrDelta;
    const pathTemplate = AppRoutePaths[to];
    const opts = (options ?? {}) as NavigateOptions<T>;

    const query = 'searchParams' in opts ? buildSearchParams(opts.searchParams) : '';
    const path = 'params' in opts ? buildPath(to, opts.params) : pathTemplate;
    const state = 'state' in opts ? opts.state : undefined;
    const fullPath = path + query;

    const navigationOptions = {
      ...(state !== undefined && { state }),
      ...(opts.replace !== undefined && { replace: opts.replace }),
      ...(opts.preventScrollReset !== undefined && { preventScrollReset: opts.preventScrollReset }),
      ...(opts.relative !== undefined && { relative: opts.relative }),
    };

    navigate(fullPath, navigationOptions);
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
