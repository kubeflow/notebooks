import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Radio } from '@patternfly/react-core/dist/esm/components/Radio';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { StorageclassesStorageClassListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { WorkspacesPodVolumeMountValue } from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { ResourceInputWrapper } from '~/app/pages/WorkspaceKinds/Form/podConfig/ResourceInputWrapper';

// DNS-1123 subdomain regex - lowercase alphanumeric, hyphens, dots
// Must start and end with alphanumeric, max 253 chars
const PVC_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

const ACCESS_MODES = [
  { label: 'ReadWriteOnce (RWO)', value: 'ReadWriteOnce' },
  { label: 'ReadWriteMany (RWX)', value: 'ReadWriteMany' },
  { label: 'ReadOnlyMany (ROX)', value: 'ReadOnlyMany' },
  { label: 'ReadWriteOncePod (RWOP)', value: 'ReadWriteOncePod' },
] as const;

export interface VolumesCreateModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onVolumeCreated: (volume: WorkspacesPodVolumeMountValue) => void;
}

export const VolumesCreateModal: React.FC<VolumesCreateModalProps> = ({
  isOpen,
  setIsOpen,
  onVolumeCreated,
}) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  // Form state
  const [pvcName, setPvcName] = useState('');
  const [storageClassName, setStorageClassName] = useState('');
  const [storageSize, setStorageSize] = useState('1Gi');
  const [accessMode, setAccessMode] = useState('ReadWriteOnce');
  const [readOnly, setReadOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Storage classes
  const [storageClasses, setStorageClasses] = useState<StorageclassesStorageClassListItem[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await api.storageClasses.listStorageClasses();
        const usable = response.data.filter((sc) => sc.canUse);
        setStorageClasses(usable);
        if (usable.length > 0) {
          setStorageClassName(usable[0].name);
        }
      } catch {
        // Storage classes unavailable - user can still type a name manually
      }
    };
    if (isOpen) {
      fetch();
    }
  }, [api.storageClasses, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPvcName('');
      setStorageSize('1Gi');
      setAccessMode('ReadWriteOnce');
      setReadOnly(false);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  const validateForm = useCallback((): string | null => {
    if (!pvcName) {
      return 'PVC name is required';
    }
    if (pvcName.length > 253) {
      return 'PVC name must be at most 253 characters';
    }
    if (!PVC_NAME_REGEX.test(pvcName)) {
      return 'PVC name must consist of lowercase alphanumeric characters or hyphens, and must start and end with an alphanumeric character';
    }
    if (!storageClassName) {
      return 'Storage class is required';
    }
    if (!storageSize) {
      return 'Storage size is required';
    }
    return null;
  }, [pvcName, storageClassName, storageSize]);

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Mount path is auto-defaulted to /data/{pvcName} and can be edited inline in the table
    const mountPath = `/data/${pvcName}`;

    try {
      await api.pvc.createPvc(selectedNamespace, {
        data: {
          name: pvcName,
          storageClassName,
          requests: { storage: storageSize },
          accessModes: [accessMode],
        },
      });
      setIsOpen(false);
      onVolumeCreated({ pvcName, mountPath, readOnly });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PVC. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    api.pvc,
    selectedNamespace,
    pvcName,
    storageClassName,
    storageSize,
    accessMode,
    setIsOpen,
    onVolumeCreated,
    readOnly,
  ]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant={ModalVariant.large}
      data-testid="create-volume-modal"
      aria-labelledby="create-volume-modal-title"
    >
      <ModalHeader title="Create New PVC" labelId="create-volume-modal-title" />
      <ModalBody>
        <Form>
          {error && (
            <Alert variant={AlertVariant.danger} isInline title="Error">
              {error}
            </Alert>
          )}
          <ThemeAwareFormGroupWrapper label="PVC Name" isRequired fieldId="pvc-name">
            <TextInput
              id="pvc-name"
              data-testid="pvc-name-input"
              isRequired
              type="text"
              value={pvcName}
              onChange={(_, val) => {
                setPvcName(val);
                setError(null);
              }}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper label="Storage Class" isRequired fieldId="storage-class">
            {storageClasses.length > 0 ? (
              <FormSelect
                id="storage-class"
                data-testid="storage-class-select"
                value={storageClassName}
                onChange={(_, val) => setStorageClassName(val)}
                aria-label="Storage class"
              >
                {storageClasses.map((sc) => (
                  <FormSelectOption
                    key={sc.name}
                    value={sc.name}
                    label={sc.displayName || sc.name}
                  />
                ))}
              </FormSelect>
            ) : (
              <TextInput
                id="storage-class"
                data-testid="storage-class-input"
                isRequired
                type="text"
                value={storageClassName}
                onChange={(_, val) => setStorageClassName(val)}
                placeholder="Enter storage class name"
              />
            )}
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Storage Size"
            isRequired
            fieldId="storage-size"
            skipFieldset
          >
            <ResourceInputWrapper
              value={storageSize}
              onChange={setStorageSize}
              type="memory"
              min={1}
              aria-label="storage-size"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Access Mode"
            isRequired
            fieldId="access-mode"
            role="radiogroup"
            skipFieldset
            isInline
          >
            {ACCESS_MODES.map(({ label, value }) => (
              <Radio
                key={value}
                id={`access-mode-${value}`}
                data-testid={`access-mode-${value}`}
                name="access-mode"
                label={label}
                value={value}
                isChecked={accessMode === value}
                onChange={() => setAccessMode(value)}
              />
            ))}
          </ThemeAwareFormGroupWrapper>
          <FormGroup fieldId="read-only" className="pf-v6-u-pt-sm">
            <Switch
              id="read-only-switch"
              data-testid="read-only-switch"
              label="Read-only access"
              isChecked={readOnly}
              onChange={(_ev, checked) => setReadOnly(checked)}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="create"
          variant="primary"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={isSubmitting || !pvcName || !storageClassName || !storageSize}
          data-testid="create-volume-submit-button"
        >
          Create
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={isSubmitting}
          data-testid="create-volume-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
