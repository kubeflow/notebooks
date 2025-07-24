import { useCallback } from 'react';
import { IActions } from '@patternfly/react-table/dist/esm/components/Table';
import { useWorkspaceActionsContext, WorkspaceAction } from '~/app/context/WorkspaceActionsContext';
import { WorkspacesWorkspace } from '~/generated/data-contracts';

export type WorkspaceRowActionId = 'viewDetails' | 'edit' | 'delete' | 'start' | 'stop' | 'restart';

interface WorkspaceRowAction {
  id: WorkspaceRowActionId;
  onActionDone?: WorkspaceAction['onActionDone'];
  isVisible?: boolean | ((workspace: WorkspacesWorkspace) => boolean);
}

type WorkspaceRowActionItem = WorkspaceRowAction | { id: 'separator' };

export const useWorkspaceRowActions = (
  actionsToInclude: WorkspaceRowActionItem[],
): ((workspace: WorkspacesWorkspace) => IActions) => {
  const actionsContext = useWorkspaceActionsContext();

  return useCallback(
    (workspace: WorkspacesWorkspace): IActions => {
      const actions: IActions = [];

      for (const item of actionsToInclude) {
        if (item.id === 'separator') {
          actions.push({ isSeparator: true });
          continue;
        }

        if (
          item.isVisible === false ||
          (typeof item.isVisible === 'function' && !item.isVisible(workspace))
        ) {
          continue;
        }

        actions.push(buildAction(item.id, item.onActionDone, workspace, actionsContext));
      }

      return actions;
    },
    [actionsContext, actionsToInclude],
  );
};

function buildAction(
  id: WorkspaceRowActionId,
  onActionDone: WorkspaceAction['onActionDone'] | undefined,
  workspace: WorkspacesWorkspace,
  actionsContext: ReturnType<typeof useWorkspaceActionsContext>,
): IActions[number] {
  const map: Record<WorkspaceRowActionId, () => IActions[number]> = {
    viewDetails: () => ({
      id,
      title: 'View Details',
      onClick: () => actionsContext.requestViewDetailsAction({ workspace }),
    }),
    edit: () => ({
      id,
      title: 'Edit',
      onClick: () => actionsContext.requestEditAction({ workspace }),
    }),
    delete: () => ({
      id,
      title: 'Delete',
      onClick: () => actionsContext.requestDeleteAction({ workspace, onActionDone }),
    }),
    start: () => ({
      id,
      title: 'Start',
      onClick: () => actionsContext.requestStartAction({ workspace, onActionDone }),
    }),
    stop: () => ({
      id,
      title: 'Stop',
      onClick: () => actionsContext.requestStopAction({ workspace, onActionDone }),
    }),
    restart: () => ({
      id,
      title: 'Restart',
      onClick: () => actionsContext.requestRestartAction({ workspace, onActionDone }),
    }),
  };

  return map[id]();
}
