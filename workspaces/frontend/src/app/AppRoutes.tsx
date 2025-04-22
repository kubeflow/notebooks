import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { NotFound } from './pages/notFound/NotFound';
import { Debug } from './pages/Debug/Debug';
import { Workspaces } from './pages/Workspaces/Workspaces';
import { WorkspaceCreation } from './pages/Workspaces/Creation/WorkspaceCreation';
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
      path: '/workspacekinds',
    },
  ];
};

export const useNavData = (): NavDataItem[] => [
  {
    label: 'Notebooks',
    path: '/workspaces',
  },
  ...useAdminDebugSettings(),
];

const AppRoutes: React.FC = () => {
  const isAdmin = true;

  return (
    <Routes>
      <Route path="/workspaces/create" element={<WorkspaceCreation />} />
      <Route path="/workspacekinds" element={<WorkspaceKinds />} />
      <Route path="/workspaces" element={<Workspaces />} />
      <Route path="/" element={<Workspaces />} />
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
