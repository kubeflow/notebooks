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
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';
import { Workspace, WorkspacePauseState } from '~/shared/api/backendApiTypes';
import { ActionButton } from '~/shared/components/ActionButton';

interface StopActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: Workspace | null;
  onStop: () => Promise<WorkspacePauseState | void>;
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
  const workspacePendingUpdate = workspace?.pendingRestart;
  const [actionOnGoing, setActionOnGoing] = useState<StopAction | null>(null);

  const executeAction = useCallback(
    (args: { action: StopAction; callback: () => ReturnType<typeof onStop> }) => {
      setActionOnGoing(args.action);
      try {
        return args.callback();
      } finally {
        setActionOnGoing(null);
      }
    },
    [],
  );

  const handleStop = useCallback(async () => {
    try {
      const response = await executeAction({ action: 'stop', callback: onStop });
      // TODO: alert user about success
      console.info('Workspace stopped successfully:', JSON.stringify(response));
      onActionDone?.();
      onClose();
    } catch (error) {
      // TODO: alert user about error
      console.error('Error stopping workspace:', error);
    }
  }, [executeAction, onActionDone, onClose, onStop]);

  // TODO: combine handleStop and handleUpdateAndStop if they end up being similar
  const handleUpdateAndStop = useCallback(async () => {
    try {
      const response = await executeAction({ action: 'updateAndStop', callback: onUpdateAndStop });
      // TODO: alert user about success
      console.info('Workspace updated and stopped successfully:', JSON.stringify(response));
      onActionDone?.();
      onClose();
    } catch (error) {
      // TODO: alert user about error
      console.error('Error updating and stopping workspace:', error);
    }
  }, [executeAction, onActionDone, onClose, onUpdateAndStop]);

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
