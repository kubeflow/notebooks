import * as React from 'react';
import { WorkspaceActionsContextProvider } from '~/app/context/WorkspaceActionsContext';
import WorkspaceKindSummary from '~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummary';

export const WorkspaceKindSummaryWrapper: React.FC = () => (
  <WorkspaceActionsContextProvider>
    <WorkspaceKindSummary />
  </WorkspaceActionsContextProvider>
);
