import * as React from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TabTitleText,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/types';
import { WorkspaceRedirectInformationView } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRedirectInformationView';

interface StartActionAlertProps {
  onClose: () => void;
  isOpen: boolean;
  workspace: Workspace | null;
}

export const WorkspaceStartActionModal: React.FC<StartActionAlertProps> = ({
  onClose,
  isOpen,
  workspace,
}) => {
  const handleClick = (isUpdate = false) => {
    if (isUpdate) {
      console.log(`Update ${workspace?.name}`);
    }
    console.log(`Start ${workspace?.name}`);
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
      <ModalHeader title="Start Workspace" />
      <ModalBody>
        <TabTitleText>
          There are pending redirect updates for that workspace. Are you sure you want to proceed?
        </TabTitleText>
        <WorkspaceRedirectInformationView />
      </ModalBody>
      <ModalFooter>
        <Button onClick={() => handleClick(true)}>Update and Start</Button>
        <Button onClick={() => handleClick(false)} variant="secondary">
          Start
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
