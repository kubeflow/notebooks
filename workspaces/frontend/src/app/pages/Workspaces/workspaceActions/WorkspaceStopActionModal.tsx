import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TabTitleText } from '@patternfly/react-core/dist/esm/components/Tabs';
import { useNotification } from 'mod-arch-core';
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';
import { ActionButton } from '~/shared/components/ActionButton';
import { ApiWorkspaceActionPauseEnvelope, WorkspacesWorkspace } from '~/generated/data-contracts';

interface StopActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: WorkspacesWorkspace | null;
  onStop: () => Promise<ApiWorkspaceActionPauseEnvelope>;
  onUpdateAndStop: () => Promise<void>;
  onActionDone?: () => void;
}

type StopAction = 'stop' | 'updateAndStop';

export const WorkspaceStopActionModal: React.FC<StopActionAlertProps> = ({
  onClose,
  isOpen,
  workspace,
  onStop,
  onUpdateAndStop,
  onActionDone,
}) => {
  const notification = useNotification();
  const workspacePendingUpdate = workspace?.pendingRestart;
  const [actionOnGoing, setActionOnGoing] = useState<StopAction | null>(null);

  const executeAction = useCallback(
    async <T,>({
      action,
      callback,
    }: {
      action: StopAction;
      callback: () => Promise<T>;
    }): Promise<T> => {
      setActionOnGoing(action);
      try {
        return await callback();
      } finally {
        setActionOnGoing(null);
      }
    },
    [],
  );

  const handleStop = useCallback(async () => {
    try {
      await executeAction({ action: 'stop', callback: onStop });
      notification.info(`Workspace '${workspace?.name}' stopped successfully`);
      onActionDone?.();
      onClose();
    } catch (error) {
      // TODO: alert user about error
      console.error('Error stopping workspace:', error);
    }
  }, [executeAction, onActionDone, onClose, onStop, notification, workspace]);

  // TODO: combine handleStop and handleUpdateAndStop if they end up being similar
  const handleUpdateAndStop = useCallback(async () => {
    try {
      await executeAction({ action: 'updateAndStop', callback: onUpdateAndStop });
      notification.info(`Workspace '${workspace?.name}' updated and stopped successfully`);
      onActionDone?.();
      onClose();
    } catch (error) {
      // TODO: alert user about error
      console.error('Error updating and stopping workspace:', error);
    }
  }, [executeAction, onActionDone, onClose, onUpdateAndStop, notification, workspace]);

  const shouldShowActionButton = useCallback(
    (action: StopAction) => !actionOnGoing || actionOnGoing === action,
    [actionOnGoing],
  );

  return (
    <Modal
      variant="medium"
      isOpen={isOpen}
      aria-describedby="modal-title-icon-description"
      aria-labelledby="title-icon-modal-title"
      onClose={onClose}
    >
      <ModalHeader title="Stop workspace" />
      <ModalBody>
        {workspacePendingUpdate ? (
          <>
            <TabTitleText>
              There are pending redirect updates for that workspace. Are you sure you want to
              proceed?
            </TabTitleText>
            <WorkspaceRedirectInformationView kind={workspace.workspaceKind.name} />
          </>
        ) : (
          <Content>Are you sure you want to stop the workspace?</Content>
        )}
      </ModalBody>
      <ModalFooter>
        {shouldShowActionButton('updateAndStop') && workspacePendingUpdate && (
          <ActionButton
            action="Update and stop"
            titleOnLoading="Stopping ..."
            onClick={() => handleUpdateAndStop()}
          >
            Update and stop
          </ActionButton>
        )}

        {shouldShowActionButton('stop') && (
          <ActionButton
            action="Stop"
            titleOnLoading="Stopping ..."
            onClick={() => handleStop()}
            variant={workspacePendingUpdate ? 'secondary' : 'primary'}
          >
            {workspacePendingUpdate ? 'Stop and defer updates' : 'Stop'}
          </ActionButton>
        )}

        {!actionOnGoing && (
          <Button variant="link" onClick={onClose}>
            Cancel
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
