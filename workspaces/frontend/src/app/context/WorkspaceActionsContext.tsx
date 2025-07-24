import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
} from '@patternfly/react-core/dist/esm/components/Drawer';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceDetails } from '~/app/pages/Workspaces/Details/WorkspaceDetails';
import { useTypedNavigate } from '~/app/routerHelper';
import { Workspace } from '~/shared/api/backendApiTypes';
import DeleteModal from '~/shared/components/DeleteModal';
import { WorkspaceStartActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceStartActionModal';
import { WorkspaceRestartActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRestartActionModal';
import { WorkspaceStopActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceStopActionModal';

export enum ActionType {
  ViewDetails = 'ViewDetails',
  Edit = 'Edit',
  Delete = 'Delete',
  Start = 'Start',
  Restart = 'Restart',
  Stop = 'Stop',
}

export interface WorkspaceAction {
  action: ActionType;
  workspace: Workspace;
  onActionDone?: () => void;
}

type RequestAction = (args: Pick<WorkspaceAction, 'workspace' | 'onActionDone'>) => void;

export type WorkspaceActionsContextType = {
  requestViewDetailsAction: RequestAction;
  requestEditAction: RequestAction;
  requestDeleteAction: RequestAction;
  requestStartAction: RequestAction;
  requestRestartAction: RequestAction;
  requestStopAction: RequestAction;
};

export const WorkspaceActionsContext = React.createContext<WorkspaceActionsContextType | undefined>(
  undefined,
);

export const useWorkspaceActionsContext = (): WorkspaceActionsContextType => {
  const context = useContext(WorkspaceActionsContext);
  if (!context) {
    throw new Error(
      'useWorkspaceActionsContext must be used within a WorkspaceActionsContextProvider',
    );
  }
  return context;
};

interface WorkspaceActionsContextProviderProps {
  children: React.ReactNode;
}

export const WorkspaceActionsContextProvider: React.FC<WorkspaceActionsContextProviderProps> = ({
  children,
}) => {
  const navigate = useTypedNavigate();
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();
  const [activeWsAction, setActiveWsAction] = useState<WorkspaceAction | null>(null);

  const drawerContent = (
    <>
      {activeWsAction && (
        <WorkspaceDetails
          workspace={activeWsAction.workspace}
          onCloseClick={() => setActiveWsAction(null)}
          onDeleteClick={() => requestDeleteAction({ workspace: activeWsAction.workspace })}
          // TODO: Uncomment when edit action is fully supported
          // onEditClick={() => executeEditAction()}
        />
      )}
    </>
  );

  const onCloseActionAlertDialog = useCallback(() => {
    setActiveWsAction(null);
  }, []);

  const createActionRequester =
    (actionType: ActionType) => (args: { workspace: Workspace; onActionDone?: () => void }) =>
      setActiveWsAction({ action: actionType, ...args });

  const requestViewDetailsAction = createActionRequester(ActionType.ViewDetails);
  const requestEditAction = createActionRequester(ActionType.Edit);
  const requestDeleteAction = createActionRequester(ActionType.Delete);
  const requestStartAction = createActionRequester(ActionType.Start);
  const requestRestartAction = createActionRequester(ActionType.Restart);
  const requestStopAction = createActionRequester(ActionType.Stop);

  const executeEditAction = useCallback(() => {
    if (!activeWsAction || activeWsAction.action !== ActionType.Edit) {
      return;
    }
    navigate('workspaceEdit', {
      state: {
        namespace: activeWsAction.workspace.namespace,
        workspaceName: activeWsAction.workspace.name,
      },
    });
  }, [navigate, activeWsAction]);

  const executeDeleteAction = useCallback(async () => {
    if (!activeWsAction || activeWsAction.action !== ActionType.Delete) {
      return;
    }

    try {
      await api.deleteWorkspace({}, selectedNamespace, activeWsAction.workspace.name);
      // TODO: alert user about success
      console.info(`Workspace '${activeWsAction.workspace.name}' deleted successfully`);
      activeWsAction.onActionDone?.();
    } catch (err) {
      // TODO: alert user about error
      console.error(`Error deleting workspace '${activeWsAction.workspace.name}': ${err}`);
    }
  }, [api, selectedNamespace, activeWsAction]);

  useEffect(() => {
    if (!activeWsAction) {
      return;
    }

    const { action } = activeWsAction;
    switch (action) {
      case ActionType.Edit:
        executeEditAction();
        break;
      case ActionType.Delete:
      case ActionType.ViewDetails:
      case ActionType.Start:
      case ActionType.Restart:
      case ActionType.Stop:
        break;
      default: {
        const value: never = action;
        console.error('Unreachable code', value);
      }
    }
  }, [activeWsAction, executeEditAction]);

  const contextValue = useMemo(
    () => ({
      requestViewDetailsAction,
      requestEditAction,
      requestDeleteAction,
      requestStartAction,
      requestRestartAction,
      requestStopAction,
    }),
    [
      requestViewDetailsAction,
      requestEditAction,
      requestDeleteAction,
      requestStartAction,
      requestRestartAction,
      requestStopAction,
    ],
  );

  return (
    <WorkspaceActionsContext.Provider value={contextValue}>
      <Drawer isInline isExpanded={activeWsAction?.action === ActionType.ViewDetails}>
        <DrawerContent panelContent={drawerContent}>
          <DrawerContentBody>
            {children}
            {activeWsAction && (
              <>
                {activeWsAction.action === ActionType.Start && (
                  <WorkspaceStartActionModal
                    isOpen
                    onClose={onCloseActionAlertDialog}
                    workspace={activeWsAction.workspace}
                    onStart={async () =>
                      api.startWorkspace({}, selectedNamespace, activeWsAction.workspace.name)
                    }
                    onActionDone={activeWsAction.onActionDone}
                    onUpdateAndStart={async () => {
                      // TODO: implement update and stop
                    }}
                  />
                )}
                {activeWsAction.action === ActionType.Restart && (
                  <WorkspaceRestartActionModal
                    isOpen
                    onClose={onCloseActionAlertDialog}
                    workspace={activeWsAction.workspace}
                  />
                )}
                {activeWsAction.action === ActionType.Stop && (
                  <WorkspaceStopActionModal
                    isOpen
                    onClose={onCloseActionAlertDialog}
                    workspace={activeWsAction.workspace}
                    onStop={async () =>
                      api.pauseWorkspace({}, selectedNamespace, activeWsAction.workspace.name)
                    }
                    onActionDone={activeWsAction.onActionDone}
                    onUpdateAndStop={async () => {
                      // TODO: implement update and stop
                    }}
                  />
                )}
                {activeWsAction.action === ActionType.Delete && (
                  <DeleteModal
                    isOpen
                    resourceName={activeWsAction.workspace.name}
                    namespace={activeWsAction.workspace.namespace}
                    title="Delete workspace?"
                    onClose={() => setActiveWsAction(null)}
                    onDelete={async () => executeDeleteAction()}
                  />
                )}
              </>
            )}
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </WorkspaceActionsContext.Provider>
  );
};
