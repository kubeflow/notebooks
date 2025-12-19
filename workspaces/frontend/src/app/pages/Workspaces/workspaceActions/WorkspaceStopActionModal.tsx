import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
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

interface StopActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: WorkspacesWorkspaceListItem | null;
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
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

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
    setError(null);
    try {
      await executeAction({ action: 'stop', callback: onStop });
      notification.info(`Workspace '${workspace?.name}' stopped successfully`);
      onActionDone?.();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [executeAction, onActionDone, onClose, onStop, notification, workspace]);

  // TODO: combine handleStop and handleUpdateAndStop if they end up being similar
  const handleUpdateAndStop = useCallback(async () => {
    setError(null);
    try {
      await executeAction({ action: 'updateAndStop', callback: onUpdateAndStop });
      notification.info(`Workspace '${workspace?.name}' updated and stopped successfully`);
      onActionDone?.();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [executeAction, onActionDone, onClose, onUpdateAndStop, notification, workspace]);

  const shouldShowActionButton = useCallback(
    (action: StopAction) => !actionOnGoing || actionOnGoing === action,
    [actionOnGoing],
  );

  return (
    <Modal
      data-testid="stop-modal"
      variant="medium"
      isOpen={isOpen}
      aria-describedby="modal-title-icon-description"
      aria-labelledby="title-icon-modal-title"
      onClose={onClose}
    >
      <ModalHeader title="Stop workspace" />
      <ModalBody>
        <Stack hasGutter>
          {error && (
            <StackItem>
              <ErrorAlert
                title="Failed to stop workspace"
                content={error}
                testId="stop-modal-error"
              />
            </StackItem>
          )}
          <StackItem>
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
          </StackItem>
        </Stack>
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
            data-testid="stop-button"
          >
            {workspacePendingUpdate ? 'Stop and defer updates' : 'Stop'}
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
