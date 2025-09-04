import React from 'react';
import { WorkspaceActionsContextProvider } from '~/app/context/WorkspaceActionsContext';
import { Workspaces } from '~/app/pages/Workspaces/Workspaces';

export const WorkspacesWrapper: React.FC = () => (
  <WorkspaceActionsContextProvider>
    <Workspaces />
  </WorkspaceActionsContextProvider>
);
