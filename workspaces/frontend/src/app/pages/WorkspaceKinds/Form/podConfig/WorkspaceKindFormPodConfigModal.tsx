import React from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  TextInput,
  Switch,
  Title,
} from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';
import { WorkspaceKindFormLabelTable } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindFormLabels';
import { emptyPodConfig } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindFormImageRedirect } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImageRedirect';

interface WorkspaceKindFormPodConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (podConfig: WorkspacePodConfigValue) => void;
  editIndex: number | null;
  currConfig: WorkspacePodConfigValue;
  setCurrConfig: (currConfig: WorkspacePodConfigValue) => void;
}

export const WorkspaceKindFormPodConfigModal: React.FC<WorkspaceKindFormPodConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editIndex,
  currConfig,
  setCurrConfig,
  // eslint-disable-next-line arrow-body-style
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader
        title={editIndex === null ? 'Create A Pod Configuration' : 'Edit Pod Configuration'}
        labelId="pod-config-modal-title"
        description={editIndex === null ? 'Add a pod configuration to your Workspace Kind' : ''}
      />
      <ModalBody>
        <Form>
          <FormGroup label="ID" isRequired fieldId="workspace-kind-pod-config-id">
            <TextInput
              isRequired
              type="text"
              value={currConfig.id}
              onChange={(_, value) => setCurrConfig({ ...currConfig, id: value })}
              id="workspace-kind-pod-config-id"
            />
          </FormGroup>
          <FormGroup label="Display Name" isRequired fieldId="workspace-kind-pod-config-name">
            <TextInput
              isRequired
              type="text"
              value={currConfig.displayName}
              onChange={(_, value) => setCurrConfig({ ...currConfig, displayName: value })}
              id="workspace-kind-pod-config-name"
            />
          </FormGroup>
          <FormGroup label="Description" isRequired fieldId="workspace-kind-pod-config-description">
            <TextInput
              isRequired
              type="text"
              value={currConfig.description}
              onChange={(_, value) => setCurrConfig({ ...currConfig, description: value })}
              id="workspace-kind-pod-config-description"
            />
          </FormGroup>
          <FormGroup label="Hidden" isRequired fieldId="workspace-kind-pod-config-hidden">
            <Switch
              isChecked={currConfig.hidden}
              aria-label="-controlled-check"
              onChange={() => setCurrConfig({ ...currConfig, hidden: !currConfig.hidden })}
              id="workspace-kind-pod-config-hidden"
              name="check5"
            />
          </FormGroup>
          <div className="pf-u-mb-0">
            <Title headingLevel="h6">Labels</Title>
            <FormGroup isRequired>
              <WorkspaceKindFormLabelTable
                rows={currConfig.labels}
                setRows={(labels) => setCurrConfig({ ...currConfig, labels })}
              />
            </FormGroup>
          </div>
          <WorkspaceKindFormImageRedirect
            redirect={currConfig.redirect || emptyPodConfig.redirect}
            setRedirect={(redirect) => setCurrConfig({ ...currConfig, redirect })}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button key="confirm" variant="primary" onClick={() => onSubmit(currConfig)}>
          {editIndex !== null ? 'Save' : 'Create'}
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
