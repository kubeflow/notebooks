import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import { useTypedLocation } from '~/app/routerHelper';
import { AppRouteKey, RouteStateMap } from '~/app/routes';

type WorkspaceFormLocationState =
  | RouteStateMap['workspaceEdit']
  | RouteStateMap['workspaceCreate']
  | RouteStateMap['workspaceKindEdit']
  | RouteStateMap['workspaceKindCreate'];

interface WorkspaceFormLocationData {
  mode: 'edit' | 'create';
  namespace: string;
  workspaceName?: string;
  workspaceKindName?: string;
}

function getRouteStateIfMatch<K extends AppRouteKey>(
  expectedRoute: K,
  actualRoute: AppRouteKey,
  state: unknown,
): Partial<RouteStateMap[K]> | undefined {
  if (expectedRoute !== actualRoute || typeof state !== 'object' || state === null) {
    return undefined;
  }

  return state as Partial<RouteStateMap[K]>;
}

export function useWorkspaceFormLocationData(): WorkspaceFormLocationData {
  const { selectedNamespace } = useNamespaceContext();
  const location = useTypedLocation<
    'workspaceEdit' | 'workspaceCreate' | 'workspaceKindEdit' | 'workspaceKindCreate'
  >();
  const routeKey = useCurrentRouteKey();
  const rawState = location.state as WorkspaceFormLocationState | undefined;

  // Workspace Edit Mode
  if (routeKey === 'workspaceEdit') {
    const editState = getRouteStateIfMatch('workspaceEdit', routeKey, rawState);
    const namespace = editState?.namespace ?? selectedNamespace;
    const workspaceName = editState?.workspaceName;

    if (!workspaceName) {
      throw new Error('Workspace name is required for edit mode');
    }

    return {
      mode: 'edit',
      namespace,
      workspaceName,
    };
  }

  // Workspace Create Mode
  if (routeKey === 'workspaceCreate') {
    const createState = getRouteStateIfMatch('workspaceCreate', routeKey, rawState);
    const namespace = createState?.namespace ?? selectedNamespace;

    return {
      mode: 'create',
      namespace,
    };
  }

  // Workspace Kind Edit Mode
  if (routeKey === 'workspaceKindEdit') {
    const editState = getRouteStateIfMatch('workspaceKindEdit', routeKey, rawState);
    const namespace = editState?.namespace ?? selectedNamespace;
    // TODO: remove default jupyterlab from workspace
    const workspaceKindName = editState?.workspaceKindName || 'jupyterlab';

    if (!workspaceKindName) {
      throw new Error('Workspace kind name is required for edit mode');
    }

    return {
      mode: 'edit',
      namespace,
      workspaceKindName,
    };
  }

  // Workspace Kind Create Mode
  if (routeKey === 'workspaceKindCreate') {
    const createState = getRouteStateIfMatch('workspaceKindCreate', routeKey, rawState);
    const namespace = createState?.namespace ?? selectedNamespace;

    return {
      mode: 'create',
      namespace,
      // formType: 'workspaceKind',
    };
  }

  throw new Error('Unknown workspace form route');
}
