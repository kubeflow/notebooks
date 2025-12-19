import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { TabTitleText } from '@patternfly/react-core/dist/esm/components/Tabs';
import { useNotification } from 'mod-arch-core';
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';
import { ActionButton } from '~/shared/components/ActionButton';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import { extractErrorMessage } from '~/shared/api/apiUtils';
import {
  ApiErrorEnvelope,
  ApiWorkspaceActionPauseEnvelope,
  WorkspacesWorkspaceListItem,
} from '~/generated/data-contracts';

interface StartActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: WorkspacesWorkspaceListItem | null;
  onStart: () => Promise<ApiWorkspaceActionPauseEnvelope>;
  onUpdateAndStart: () => Promise<void>;
  onActionDone?: () => void;
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
  const notification = useNotification();
  const [actionOnGoing, setActionOnGoing] = useState<StartAction | null>(null);
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

  const executeAction = useCallback(
    async <T,>({
      action,
      callback,
    }: {
      action: StartAction;
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

  const handleStart = useCallback(async () => {
    setError(null);
    try {
      await executeAction({ action: 'start', callback: onStart });
      notification.info(`Workspace '${workspace?.name}' started successfully`);
      onActionDone?.();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [executeAction, onActionDone, onClose, onStart, notification, workspace]);

  // TODO: combine handleStart and handleUpdateAndStart if they end up being similar
  const handleUpdateAndStart = useCallback(async () => {
    setError(null);
    try {
      await executeAction({
        action: 'updateAndStart',
        callback: onUpdateAndStart,
      });
      notification.info(`Workspace '${workspace?.name}' updated and started successfully`);
      onActionDone?.();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [executeAction, onActionDone, onClose, onUpdateAndStart, notification, workspace]);

  const shouldShowActionButton = useCallback(
    (action: StartAction) => !actionOnGoing || actionOnGoing === action,
    [actionOnGoing],
  );

  return (
    <Modal
      data-testid="start-modal"
      variant="medium"
      isOpen={isOpen}
      aria-describedby="modal-title-icon-description"
      aria-labelledby="title-icon-modal-title"
      onClose={onClose}
    >
      <ModalHeader title="Start Workspace" />
      <ModalBody>
        <Stack hasGutter>
          {error && (
            <StackItem>
              <ErrorAlert
                title="Failed to start workspace"
                content={error}
                testId="start-modal-error"
              />
            </StackItem>
          )}
          <StackItem>
            <TabTitleText>
              There are pending redirect updates for that workspace. Are you sure you want to
              proceed?
            </TabTitleText>
          </StackItem>
          {workspace && (
            <StackItem>
              <WorkspaceRedirectInformationView kind={workspace.workspaceKind.name} />
            </StackItem>
          )}
        </Stack>
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
            data-testid="start-button"
          >
            Start
          </ActionButton>
        )}
        {!actionOnGoing && (
          <Button variant="link" onClick={onClose} data-testid="cancel-button">
            Cancel
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
