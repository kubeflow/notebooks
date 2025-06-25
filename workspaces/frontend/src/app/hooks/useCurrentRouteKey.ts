import { matchPath } from 'react-router-dom';
import { AppRouteKey, AppRoutePaths } from '~/app/routes';
import { useTypedLocation } from '~/app/routerHelper';

export function useCurrentRouteKey(): AppRouteKey | undefined {
  const location = useTypedLocation();
  const { pathname } = location;

  const matchEntries = Object.entries(AppRoutePaths) as [AppRouteKey, string][];

  for (const [routeKey, pattern] of matchEntries) {
    const match = matchPath({ path: pattern, end: true }, pathname);
    if (match) {
      return routeKey;
    }
  }

  return undefined;
}
