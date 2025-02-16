import * as React from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TabTitleText,
  Content,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/types';
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';

interface StopActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: Workspace | null;
}

export const WorkspaceStopActionModal: React.FC<StopActionAlertProps> = ({
  onClose,
  isOpen,
  workspace,
}) => {
  const workspacePendingUpdate = workspace?.status.pendingRestart;
  const handleClick = (isUpdate = false) => {
    if (isUpdate) {
      console.log(`Update ${workspace?.name}`);
    }
    console.log(`Stop ${workspace?.name}`);
    onClose();
  };
  return (
    <Modal
      variant="medium"
      isOpen={isOpen}
      aria-describedby="modal-title-icon-description"
      aria-labelledby="title-icon-modal-title"
      onClose={onClose}
    >
      <ModalHeader title="Stop Workspace" />
      <ModalBody>
        {workspacePendingUpdate ? (
          <>
            <TabTitleText>
              There are pending redirect updates for that workspace. Are you sure you want to
              proceed?
            </TabTitleText>
            <WorkspaceRedirectInformationView />
          </>
        ) : (
          <Content>Are you sure you want to stop the workspace?</Content>
        )}
      </ModalBody>
      <ModalFooter>
        {workspacePendingUpdate && (
          <Button onClick={() => handleClick(true)}>Update and Stop</Button>
        )}
        <Button
          onClick={() => handleClick(false)}
          variant={workspacePendingUpdate ? 'secondary' : 'primary'}
        >
          {workspacePendingUpdate ? 'Stop and defer updates' : 'Stop'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
