import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { MultiTypeaheadSelect, MultiTypeaheadSelectOption } from '@patternfly/react-templates';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { ValidatedOptions } from '@patternfly/react-core/helpers';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { isValidDefaultMode } from '~/app/pages/Workspaces/Form/helpers';

export interface SecretsAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onClose: (secrets: SecretsSecretListItem[], mountPath: string, mode: number) => void;
  selectedSecrets: string[];
  availableSecrets: SecretsSecretListItem[];
  initialMountPath?: string;
  initialDefaultMode?: string;
}

export const SecretsAttachModal: React.FC<SecretsAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onClose,
  selectedSecrets,
  availableSecrets,
  initialMountPath = '',
  initialDefaultMode = '',
}) => {
  const [selected, setSelected] = useState<string[]>(selectedSecrets);
  const [mountPath, setMountPath] = useState(initialMountPath);
  const [defaultMode, setDefaultMode] = useState(initialDefaultMode);
  const [isDefaultModeValid, setIsDefaultModeValid] = useState(true);

  // Sync state with props when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setSelected(selectedSecrets);
      setMountPath(initialMountPath);
      setDefaultMode(initialDefaultMode);
      setIsDefaultModeValid(true);
    }
  }, [isOpen, selectedSecrets, initialMountPath, initialDefaultMode]);

  const handleDefaultModeChange = (val: string) => {
    if (val.length <= 3) {
      setDefaultMode(val);
      const isValid = isValidDefaultMode(val);
      setIsDefaultModeValid(val.length === 3 && isValid);
    }
  };

  const initialOptions = useMemo<MultiTypeaheadSelectOption[]>(
    () =>
      availableSecrets.map((secret) => ({
        content: secret.name,
        value: secret.name,
        selected: selectedSecrets.includes(secret.name),
        isDisabled: !secret.canMount,
        description: `Type: ${secret.type}`,
      })),
    [availableSecrets, selectedSecrets],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="BasicModal"
      aria-labelledby="basic-modal-title"
      aria-describedby="modal-box-body-basic"
      variant={ModalVariant.medium}
    >
      <ModalHeader title="Attach Existing Secrets" labelId="basic-modal-title" />
      <ModalBody id="modal-box-body-basic">
        <Form>
          <FormGroup label="Secret" fieldId="secret-select">
            <MultiTypeaheadSelect
              initialOptions={initialOptions}
              id="secret-select"
              placeholder="Select a secret"
              noOptionsFoundMessage={(filter) => `No secret was found for "${filter}"`}
              onSelectionChange={(_ev, selections) => setSelected(selections as string[])}
            />
          </FormGroup>
          <FormGroup label="Mount Path" isRequired fieldId="mount-path">
            <TextInput
              name="mountPath"
              isRequired
              type="text"
              value={mountPath}
              onChange={(_, val) => setMountPath(val)}
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
              onChange={(_, val) => handleDefaultModeChange(val)}
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
          key="attach"
          variant="primary"
          isDisabled={!isDefaultModeValid || !mountPath || selected.length === 0}
          onClick={() =>
            onClose(
              availableSecrets.filter((secret) => selected.includes(secret.name)),
              mountPath,
              parseInt(defaultMode, 8),
            )
          }
        >
          Attach
        </Button>
        <Button key="cancel" variant="link" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
