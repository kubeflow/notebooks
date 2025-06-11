import React, { useCallback, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TabTitleText,
} from '@patternfly/react-core';
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';
import { Workspace } from '~/shared/api/backendApiTypes';
import { ActionButton } from '~/shared/components/ActionButton';

interface StartActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: Workspace | null;
  onStart: () => Promise<void>;
  onUpdateAndStart: () => Promise<void>;
  onActionDone: () => void;
}

type StartAction = 'start' | 'updateAndStart';

export const WorkspaceStartActionModal: React.FC<StartActionAlertProps> = ({
  onClose,
  isOpen,
  workspace,
  onStart,
  onUpdateAndStart,
  onActionDone,
}) => {
  const [actionOnGoing, setActionOnGoing] = useState<StartAction | null>(null);

  const executeAction = useCallback(
    async (args: { action: StartAction; callback: () => Promise<void> }) => {
      setActionOnGoing(args.action);
      try {
        return await args.callback();
      } finally {
        setActionOnGoing(null);
      }
    },
    [],
  );

  const handleStart = useCallback(async () => {
    try {
      await executeAction({ action: 'start', callback: onStart });
      // TODO: alert user about success
      console.info('Workspace started successfully');
      onActionDone();
      onClose();
    } catch (error) {
      // TODO: alert user about error
      console.error('Error starting workspace:', error);
    }
  }, [executeAction, onActionDone, onClose, onStart]);

  // TODO: combine handleStart and handleUpdateAndStart if they end up being similar
  const handleUpdateAndStart = useCallback(async () => {
    try {
      await executeAction({ action: 'updateAndStart', callback: onUpdateAndStart });
      // TODO: alert user about success
      console.info('Workspace updated and started successfully');
      onActionDone();
      onClose();
    } catch (error) {
      // TODO: alert user about error
      console.error('Error updating and stopping workspace:', error);
    }
  }, [executeAction, onActionDone, onClose, onUpdateAndStart]);

  const shouldShowActionButton = useCallback(
    (action: StartAction) => !actionOnGoing || actionOnGoing === action,
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
      <ModalHeader title="Start Workspace" />
      <ModalBody>
        <TabTitleText>
          There are pending redirect updates for that workspace. Are you sure you want to proceed?
        </TabTitleText>
        {workspace && <WorkspaceRedirectInformationView kind={workspace.workspaceKind.name} />}
      </ModalBody>
      <ModalFooter>
        {shouldShowActionButton('updateAndStart') && (
          <ActionButton
            action="Update and Start"
            titleOnLoading="Starting ..."
            onClick={() => handleUpdateAndStart()}
          >
            Update and Start
          </ActionButton>
        )}
        {shouldShowActionButton('start') && (
          <ActionButton
            action="Start"
            titleOnLoading="Starting ..."
            onClick={() => handleStart()}
            variant="secondary"
          >
            Start
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
