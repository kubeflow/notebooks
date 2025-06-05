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
  FormSelect,
  FormSelectOption,
  Switch,
  Title,
} from '@patternfly/react-core';
import { WorkspaceKindImageConfigValue } from '~/app/types';
import { ImagePullPolicy } from '~/shared/api/backendApiTypes';
import { WorkspaceKindFormLabelTable } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindFormLabels';
import { emptyImage } from '~/app/pages/WorkspaceKinds/Form/helpers';

import { WorkspaceKindFormImageRedirect } from './WorkspaceKindFormImageRedirect';
import { WorkspaceKindFormImagePort } from './WorkspaceKindFormImagePort';

interface WorkspaceKindFormImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (image: WorkspaceKindImageConfigValue) => void;
  editIndex: number | null;
  image: WorkspaceKindImageConfigValue;
  setImage: (image: WorkspaceKindImageConfigValue) => void;
}

export const WorkspaceKindFormImageModal: React.FC<WorkspaceKindFormImageModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editIndex,
  image,
  setImage,
}) => {
  const options = [
    { value: 'please choose', label: 'Select one', disabled: true },
    { value: ImagePullPolicy.IfNotPresent, label: ImagePullPolicy.IfNotPresent, disabled: false },
    { value: ImagePullPolicy.Always, label: ImagePullPolicy.Always, disabled: false },
    { value: ImagePullPolicy.Never, label: ImagePullPolicy.Never, disabled: false },
  ];
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader
        title={editIndex === null ? 'Create Image' : 'Edit Image'}
        labelId="image-modal-title"
        description={editIndex === null ? 'Add an image configuration to your Workspace Kind' : ''}
      />
      <ModalBody>
        <Form>
          <FormGroup label="ID" isRequired fieldId="workspace-kind-image-id">
            <TextInput
              isRequired
              type="text"
              value={image.id}
              onChange={(_, value) => setImage({ ...image, id: value })}
              id="workspace-kind-image-id"
            />
          </FormGroup>
          <FormGroup label="Display Name" isRequired fieldId="workspace-kind-image-name">
            <TextInput
              isRequired
              type="text"
              value={image.displayName}
              onChange={(_, value) => setImage({ ...image, displayName: value })}
              id="workspace-kind-image-name"
            />
          </FormGroup>
          <FormGroup label="Image URL" isRequired fieldId="workspace-kind-image-url">
            <TextInput
              isRequired
              type="url"
              value={image.image}
              onChange={(_, value) => setImage({ ...image, image: value })}
              id="workspace-kind-image-url"
            />
          </FormGroup>
          <FormGroup label="Description" isRequired fieldId="workspace-kind-image-description">
            <TextInput
              isRequired
              type="text"
              value={image.description}
              onChange={(_, value) => setImage({ ...image, description: value })}
              id="workspace-kind-image-description"
            />
          </FormGroup>
          <FormGroup label="Hidden" isRequired fieldId="workspace-kind-image-hidden">
            <Switch
              isChecked={image.hidden}
              aria-label="-controlled-check"
              onChange={() => setImage({ ...image, hidden: !image.hidden })}
              id="workspace-kind-image-hidden"
              name="check5"
            />
          </FormGroup>
          <FormGroup
            label="Image Pull Policy"
            isRequired
            fieldId="workspace-kind-image-pull-policy"
          >
            <FormSelect
              value={image.imagePullPolicy}
              onChange={(_, value) =>
                setImage({ ...image, imagePullPolicy: value as ImagePullPolicy })
              }
              aria-label="FormSelect Input"
              id="workspace-kind-image-pull-policy"
              ouiaId="BasicFormSelect"
            >
              {options.map((option, index) => (
                <FormSelectOption
                  isDisabled={option.disabled}
                  key={index}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </FormSelect>
          </FormGroup>
          <div className="pf-u-mb-0">
            <Title headingLevel="h6">Labels</Title>
            <FormGroup isRequired>
              <WorkspaceKindFormLabelTable
                rows={image.labels}
                setRows={(labels) => setImage({ ...image, labels })}
              />
            </FormGroup>
          </div>
          <WorkspaceKindFormImagePort
            ports={image.ports}
            setPorts={(ports) => setImage({ ...image, ports })}
          />
          <WorkspaceKindFormImageRedirect
            redirect={image.redirect || emptyImage.redirect}
            setRedirect={(redirect) => setImage({ ...image, redirect })}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button key="confirm" variant="primary" onClick={() => onSubmit(image)}>
          {editIndex !== null ? 'Save' : 'Create'}
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
