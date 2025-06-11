import * as React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { AppRoutePaths } from '~/app/routes';
import { WorkspaceForm } from '~/app/pages/Workspaces/Form/WorkspaceForm';
import { NotFound } from './pages/notFound/NotFound';
import { Debug } from './pages/Debug/Debug';
import { Workspaces } from './pages/Workspaces/Workspaces';
import '~/shared/style/MUI-theme.scss';
import { WorkspaceKinds } from './pages/WorkspaceKinds/WorkspaceKinds';

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
  // get auth access for example set admin as true
  const isAdmin = true; //this should be a call to getting auth / role access

  // TODO: Remove the linter skip when we implement authentication
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!isAdmin) {
    return [];
  }

  return [
    {
      label: 'Debug',
      children: [{ label: 'Notebooks', path: '/notebookDebugSettings' }],
    },
    {
      label: 'Workspace Kinds',
      path: AppRoutePaths.workspaceKinds,
    },
  ];
};

export const useNavData = (): NavDataItem[] => [
  {
    label: 'Notebooks',
    path: AppRoutePaths.workspaces,
  },
  ...useAdminDebugSettings(),
];

const AppRoutes: React.FC = () => {
  const isAdmin = true;

  return (
    <Routes>
      <Route path={AppRoutePaths.workspaceCreate} element={<WorkspaceForm />} />
      <Route path={AppRoutePaths.workspaceEdit} element={<WorkspaceForm />} />
      <Route path={AppRoutePaths.workspaces} element={<Workspaces />} />
      <Route path={AppRoutePaths.workspaceKinds} element={<WorkspaceKinds />} />
      <Route path="/" element={<Navigate to={AppRoutePaths.workspaces} replace />} />
      <Route path="*" element={<NotFound />} />
      {
        // TODO: Remove the linter skip when we implement authentication
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isAdmin && <Route path="/notebookDebugSettings/*" element={<Debug />} />
      }
    </Routes>
  );
};

export default AppRoutes;
