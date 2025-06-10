import * as React from 'react';
import { Content, ContentVariants, PageSection, Stack, StackItem } from '@patternfly/react-core';
import { IActions } from '@patternfly/react-table';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useWorkspaceActionsContext } from '~/app/context/WorkspaceActionsContext';
import { useWorkspacesByNamespace } from '~/app/hooks/useWorkspaces';
import { Workspace, WorkspaceState } from '~/shared/api/backendApiTypes';
import { DEFAULT_POLLING_RATE_MS } from '~/app/const';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';

export const Workspaces: React.FunctionComponent = () => {
  const { selectedNamespace } = useNamespaceContext();
  const workspaceActions = useWorkspaceActionsContext();

  const [workspaces, workspacesLoaded, workspacesLoadError, refreshWorkspaces] =
    useWorkspacesByNamespace(selectedNamespace);

  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshWorkspaces();
    }, DEFAULT_POLLING_RATE_MS);
    return () => clearInterval(interval);
  }, [refreshWorkspaces]);

  const tableRowActions = React.useCallback(
    (workspace: Workspace) => {
      const rowActions: IActions = [
        {
          id: 'view-details',
          title: 'View Details',
          onClick: () => workspaceActions.requestViewDetailsAction({ workspace }),
        },
        // TODO: Uncomment when edit action is fully supported
        // {
        //   id: 'edit',
        //   title: 'Edit',
        //   onClick: () => workspaceContext.requestEditAction(workspace),
        // },
        {
          id: 'delete',
          title: 'Delete',
          onClick: () =>
            workspaceActions.requestDeleteAction({ workspace, onActionDone: refreshWorkspaces }),
        },
        {
          isSeparator: true,
        },
      ];

      if (workspace.state === WorkspaceState.WorkspaceStateRunning) {
        rowActions.push(
          {
            id: 'stop',
            title: 'Stop',
            onClick: () =>
              workspaceActions.requestStopAction({ workspace, onActionDone: refreshWorkspaces }),
          },
          {
            id: 'restart',
            title: 'Restart',
            onClick: () =>
              workspaceActions.requestRestartAction({ workspace, onActionDone: refreshWorkspaces }),
          },
        );
      } else {
        rowActions.push({
          id: 'start',
          title: 'Start',
          onClick: () =>
            workspaceActions.requestStartAction({ workspace, onActionDone: refreshWorkspaces }),
        });
      }
      return rowActions;
    },
    [refreshWorkspaces, workspaceActions],
  );

  if (workspacesLoadError) {
    return <LoadError error={workspacesLoadError} />;
  }

  if (!workspacesLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <PageSection isFilled>
      <Stack hasGutter>
        <StackItem>
          <Content component={ContentVariants.h1}>Kubeflow Workspaces</Content>
        </StackItem>
        <StackItem>
          <Content component={ContentVariants.p}>
            View your existing workspaces or create new workspaces.
          </Content>
        </StackItem>
        <StackItem isFilled>
          <WorkspaceTable workspaces={workspaces} rowActions={tableRowActions} />
        </StackItem>
      </Stack>
    </PageSection>
  );
};
