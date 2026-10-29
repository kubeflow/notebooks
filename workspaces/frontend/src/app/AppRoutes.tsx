import React from 'react';
import axios from 'axios';
import { Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { AppRoutePaths } from '~/app/routes';
import { WorkspaceKindSummaryWrapper } from '~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummaryWrapper';
import { WorkspaceForm } from '~/app/pages/Workspaces/Form/WorkspaceForm';
import { useAppContext } from '~/app/context/AppContext';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { LoadError } from '~/app/components/LoadError';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { WorkspaceKindsRestrictedAccess } from '~/app/components/WorkspaceKindsRestrictedAccess';
import { DEV_MODE } from '~/shared/utilities/const';
import { Debug } from './pages/Debug/Debug';
import { NotFound } from './pages/notFound/NotFound';
import { WorkspaceKinds } from './pages/WorkspaceKinds/WorkspaceKinds';
import { WorkspacesWrapper } from './pages/Workspaces/WorkspacesWrapper';
import { WorkspaceKindForm } from './pages/WorkspaceKinds/Form/WorkspaceKindForm';

export const isNavDataGroup = (navItem: NavDataItem): navItem is NavDataGroup =>
  'children' in navItem;

type NavDataCommon = {
  label: string;
};

export type NavDataHref = NavDataCommon & {
  path: string;
};

export type NavDataGroup = NavDataCommon & {
  children: NavDataHref[];
};

type NavDataItem = NavDataHref | NavDataGroup;

export const useAdminDebugSettings = (): NavDataItem[] => {
  const { user } = useAppContext();

  if (!user?.clusterAdmin) {
    return [];
  }

  return [
    {
      label: 'Workspace kinds',
      path: AppRoutePaths.workspaceKinds,
    },
    ...(DEV_MODE
      ? [
          {
            label: 'Debug',
            children: [{ label: 'Settings', path: AppRoutePaths.notebookDebugSettings }],
          },
        ]
      : []),
  ];
};

export const useNavData = (): NavDataItem[] => [
  {
    label: 'Workspaces',
    path: AppRoutePaths.workspaces,
  },
  ...useAdminDebugSettings(),
];

// Uses the backend's `list workspacekinds` check as the access signal. The shipped RBAC
// grants list together with create/update, but custom RBAC may not. Don't pass a
// namespaceFilter: the backend then checks workspace create permission instead.
const WorkspaceKindAdminRoute: React.FC = () => {
  const [, loaded, error] = useWorkspaceKinds();

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      return <WorkspaceKindsRestrictedAccess />;
    }
    return <LoadError title="Failed to load workspace kinds" error={error} />;
  }

  if (!loaded) {
    return <LoadingSpinner />;
  }

  return <Outlet />;
};

const AppRoutes: React.FC = () => {
  const { user } = useAppContext();

  return (
    <Routes>
      <Route path={AppRoutePaths.workspaceCreate} element={<WorkspaceForm />} />
      <Route path={AppRoutePaths.workspaceEdit} element={<WorkspaceForm />} />
      <Route path={AppRoutePaths.workspaces} element={<WorkspacesWrapper />} />
      <Route path={AppRoutePaths.workspaceKindSummary} element={<WorkspaceKindSummaryWrapper />} />
      <Route path={AppRoutePaths.workspaceKinds} element={<WorkspaceKinds />} />
      <Route element={<WorkspaceKindAdminRoute />}>
        <Route path={AppRoutePaths.workspaceKindCreate} element={<WorkspaceKindForm />} />
        <Route path={AppRoutePaths.workspaceKindEdit} element={<WorkspaceKindForm />} />
      </Route>
      <Route
        path={AppRoutePaths.root}
        element={<Navigate to={AppRoutePaths.workspaces} replace />}
      />
      {user?.clusterAdmin && (
        <Route path={AppRoutePaths.notebookDebugSettings} element={<Debug />} />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
