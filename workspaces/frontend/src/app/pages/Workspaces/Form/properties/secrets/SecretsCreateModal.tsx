import React, { useEffect, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { ValidatedOptions } from '@patternfly/react-core/helpers';
import { WorkspacesPodSecretMount } from '~/generated/data-contracts';
import { isValidDefaultMode } from '~/app/pages/Workspaces/Form/helpers';

const DEFAULT_MODE_OCTAL = (420).toString(8);

export interface SecretsCreateModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (secret: WorkspacesPodSecretMount) => void;
  editSecret?: WorkspacesPodSecretMount;
}

export const SecretsCreateModal: React.FC<SecretsCreateModalProps> = ({
  isOpen,
  setIsOpen,
  onSubmit,
  editSecret,
}) => {
  const [formData, setFormData] = useState<WorkspacesPodSecretMount>({
    secretName: '',
    mountPath: '',
    defaultMode: parseInt(DEFAULT_MODE_OCTAL, 8),
  });
  const [defaultMode, setDefaultMode] = useState(DEFAULT_MODE_OCTAL);
  const [isDefaultModeValid, setIsDefaultModeValid] = useState(true);

  // Sync state when modal opens or editSecret changes
  useEffect(() => {
    if (isOpen) {
      if (editSecret) {
        setFormData(editSecret);
        setDefaultMode(editSecret.defaultMode?.toString(8) ?? DEFAULT_MODE_OCTAL);
      } else {
        setFormData({
          secretName: '',
          mountPath: '',
          defaultMode: parseInt(DEFAULT_MODE_OCTAL, 8),
        });
        setDefaultMode(DEFAULT_MODE_OCTAL);
      }
      setIsDefaultModeValid(true);
    }
  }, [isOpen, editSecret]);

  const handleDefaultModeInput = (val: string) => {
    if (val.length <= 3) {
      // 0 no permissions, 4 read only, 5 read + execute, 6 read + write, 7 all permissions
      setDefaultMode(val);
      const isValid = isValidDefaultMode(val);
      setIsDefaultModeValid(val.length === 3 && isValid);
      const decimalVal = parseInt(val, 8);
      setFormData({ ...formData, defaultMode: decimalVal });
    }
  };

  const handleSubmit = () => {
    if (!formData.secretName || !formData.mountPath || !isDefaultModeValid) {
      return;
    }
    onSubmit(formData);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} variant={ModalVariant.small}>
      <ModalHeader
        title={editSecret ? 'Edit Secret' : 'Create Secret'}
        labelId="secret-modal-title"
        description={
          !editSecret
            ? 'Add a secret to securely use API keys, tokens, or other credentials in your workspace.'
            : ''
        }
      />
      <ModalBody id="secret-modal-box-body">
        <Form onSubmit={handleSubmit}>
          <FormGroup label="Secret Name" isRequired fieldId="secret-name">
            <TextInput
              name="secretName"
              isRequired
              type="text"
              value={formData.secretName}
              onChange={(_, val) => setFormData({ ...formData, secretName: val })}
              id="secret-name"
            />
          </FormGroup>
          <FormGroup label="Mount Path" isRequired fieldId="mount-path">
            <TextInput
              name="mountPath"
              isRequired
              type="text"
              value={formData.mountPath}
              onChange={(_, val) => setFormData({ ...formData, mountPath: val })}
              id="mount-path"
            />
          </FormGroup>
          <FormGroup label="Default Mode" isRequired fieldId="default-mode">
            <TextInput
              name="defaultMode"
              isRequired
              type="text"
              value={defaultMode}
              validated={!isDefaultModeValid ? ValidatedOptions.error : undefined}
              onChange={(_, val) => handleDefaultModeInput(val)}
              id="default-mode"
            />
            {!isDefaultModeValid && (
              <HelperText>
                <HelperTextItem variant="error">
                  Must be a valid UNIX file system permission value (i.e. 644)
                </HelperTextItem>
              </HelperText>
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="confirm"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={!isDefaultModeValid || !formData.secretName || !formData.mountPath}
        >
          {editSecret ? 'Save' : 'Create'}
        </Button>
        <Button key="cancel" variant="link" onClick={handleClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
