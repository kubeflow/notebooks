import React from 'react';
import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TabTitleText,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/api/backendApiTypes';
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';

interface RestartActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: Workspace | null;
}

export const WorkspaceRestartActionModal: React.FC<RestartActionAlertProps> = ({
  onClose,
  isOpen,
  workspace,
}) => {
  const workspacePendingUpdate = workspace?.pendingRestart;
  const handleClick = (isUpdate = false) => {
    if (isUpdate) {
      console.log(`Update ${workspace?.name}`);
    }
    console.log(`Restart ${workspace?.name}`);
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
      <ModalHeader title="Restart Workspace" />
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
          <Content>Are you sure you want to restart the workspace?</Content>
        )}
      </ModalBody>
      <ModalFooter>
        {workspacePendingUpdate && (
          <Button onClick={() => handleClick(true)}>Update and Restart</Button>
        )}
        <Button
          onClick={() => handleClick(false)}
          variant={workspacePendingUpdate ? 'secondary' : 'primary'}
        >
          Restart
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
