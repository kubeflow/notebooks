import React from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { WorkspaceKindImageConfigValue, ImagePullPolicy } from '~/app/types';
import { EditableLabels } from '~/app/pages/WorkspaceKinds/Form/EditableLabels';
import { emptyImage } from '~/app/pages/WorkspaceKinds/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceKindFormImageRedirect } from './WorkspaceKindFormImageRedirect';
import { WorkspaceKindFormImagePort } from './WorkspaceKindFormImagePort';

interface WorkspaceKindFormImageModalProps {
  mode: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (image: WorkspaceKindImageConfigValue) => void;
  editIndex: number | null;
  image: WorkspaceKindImageConfigValue;
  setImage: (image: WorkspaceKindImageConfigValue) => void;
}

export const WorkspaceKindFormImageModal: React.FC<WorkspaceKindFormImageModalProps> = ({
  mode,
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
    <Modal isOpen={isOpen} onClose={onClose} variant="medium" data-testid="image-modal">
      <ModalHeader
        title={
          <span data-testid="image-modal-title">
            {editIndex === null ? 'Add Image' : 'Edit Image'}
          </span>
        }
        labelId="image-modal-title"
        description={editIndex === null ? 'Add an image configuration to your Workspace Kind' : ''}
      />
      <ModalBody>
        <Form>
          <ThemeAwareFormGroupWrapper label="ID" isRequired fieldId="workspace-kind-image-id">
            <TextInput
              isRequired
              type="text"
              value={image.id}
              onChange={(_, value) => setImage({ ...image, id: value })}
              id="workspace-kind-image-id"
              data-testid="workspace-kind-image-id-input"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            isRequired
            fieldId="workspace-kind-image-name"
          >
            <TextInput
              isRequired
              type="text"
              value={image.displayName}
              onChange={(_, value) => setImage({ ...image, displayName: value })}
              id="workspace-kind-image-name"
              data-testid="workspace-kind-image-name-input"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Description"
            fieldId="workspace-kind-image-description"
          >
            <TextInput
              isRequired
              type="text"
              value={image.description}
              onChange={(_, value) => setImage({ ...image, description: value })}
              id="workspace-kind-image-description"
              data-testid="workspace-kind-image-description-input"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Image URL"
            isRequired
            fieldId="workspace-kind-image-url"
          >
            <TextInput
              isRequired
              type="url"
              value={image.image}
              onChange={(_, value) => setImage({ ...image, image: value })}
              id="workspace-kind-image-url"
              data-testid="workspace-kind-image-url-input"
            />
          </ThemeAwareFormGroupWrapper>
          <FormGroup
            isRequired
            fieldId="workspace-kind-image-hidden"
            style={{ marginTop: 'var(--mui-spacing-16px)' }}
          >
            <Switch
              isChecked={image.hidden}
              label={
                <div>
                  <div>Hidden</div>
                  <HelperText>Hide this image from users</HelperText>
                </div>
              }
              aria-label="-controlled-check"
              onChange={() => setImage({ ...image, hidden: !image.hidden })}
              id="workspace-kind-image-hidden"
              name="workspace-kind-image-hidden-switch"
            />
          </FormGroup>
          <EditableLabels
            rows={image.labels}
            setRows={(labels) => setImage({ ...image, labels })}
          />
          <ThemeAwareFormGroupWrapper
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
          </ThemeAwareFormGroupWrapper>
          <WorkspaceKindFormImagePort
            ports={image.ports || []}
            setPorts={(ports) => setImage({ ...image, ports })}
          />
          {mode === 'edit' && (
            <WorkspaceKindFormImageRedirect
              redirect={image.redirect || emptyImage.redirect}
              setRedirect={(redirect) => setImage({ ...image, redirect })}
            />
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="confirm"
          variant="primary"
          onClick={() => onSubmit(image)}
          data-testid="image-modal-submit-button"
        >
          {editIndex !== null ? 'Save' : 'Add'}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={onClose}
          data-testid="image-modal-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
