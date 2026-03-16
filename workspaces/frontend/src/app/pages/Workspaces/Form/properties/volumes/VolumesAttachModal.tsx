import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { TypeaheadSelect } from '@patternfly/react-templates';
import {
  PvcsPVCListItem,
  StorageclassesStorageClassListItem,
  V1PersistentVolumeAccessMode,
} from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import {
  normalizeMountPath,
  validateMountPath,
  getMountPathUniquenessError,
  buildPVCSelectOptions,
} from '~/app/pages/Workspaces/Form/helpers';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';

const PVC_SELECT_EMPTY_KEY = 'pvc-select-empty';

export interface VolumesAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAttach: (pvc: PvcsPVCListItem, mountPath: string, readOnly: boolean) => void;
  availablePVCs: PvcsPVCListItem[];
  /** Set of mount paths already in use across all attached volumes */
  mountedPaths: Set<string>;
  /**
   * When provided the mount path is locked to this value (sourced from the
   * workspace kind's podTemplate.volumeMounts.home) and cannot be edited.
   */
  fixedMountPath?: string;
  /** PVC names already mounted in the other volume section (home or data) */
  excludedPvcNames?: Set<string>;
  /** API-loaded storage classes for display name and description lookup */
  storageClasses: StorageclassesStorageClassListItem[];
}

const isRWO = (pvc: PvcsPVCListItem): boolean =>
  pvc.pvcSpec.accessModes.includes(V1PersistentVolumeAccessMode.ReadWriteOnce) ||
  pvc.pvcSpec.accessModes.includes(V1PersistentVolumeAccessMode.ReadWriteOncePod);

const isInUse = (pvc: PvcsPVCListItem): boolean => pvc.pods.length > 0 || pvc.workspaces.length > 0;

export const VolumesAttachModal: React.FC<VolumesAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
  availablePVCs,
  mountedPaths,
  fixedMountPath,
  excludedPvcNames,
  storageClasses,
}) => {
  // ── Form state ───────────────────────────────────────────────────────────

  const [selectedPvcName, setSelectedPvcName] = useState('');
  const [mountPath, setMountPath] = useState(fixedMountPath ?? '/data/');
  const [isMountPathEditing, setIsMountPathEditing] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [formError, setFormError] = useState('');

  const mountPathFormatError = isMountPathEditing ? validateMountPath(mountPath) : null;
  const mountPathUniquenessError = !mountPathFormatError
    ? getMountPathUniquenessError(mountedPaths, mountPath)
    : null;
  const mountPathError = mountPathFormatError ?? mountPathUniquenessError;

  // ── Reset on open ────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setSelectedPvcName('');
      setMountPath(fixedMountPath ?? '/data/');
      setIsMountPathEditing(false);
      setReadOnly(false);
      setFormError('');
    }
  }, [isOpen, fixedMountPath]);

  // ── Mount path handlers ──────────────────────────────────────────────────

  const handleStartMountPathEdit = useCallback(() => {
    setIsMountPathEditing(true);
    setFormError('');
  }, []);

  const handleConfirmMountPathEdit = useCallback(() => {
    const err =
      validateMountPath(mountPath) ?? getMountPathUniquenessError(mountedPaths, mountPath);
    if (err) {
      return;
    }
    setIsMountPathEditing(false);
  }, [mountPath, mountedPaths]);

  const handleCancelMountPathEdit = useCallback(() => {
    if (selectedPvcName) {
      setMountPath(fixedMountPath ?? `/data/${selectedPvcName}`);
    } else {
      setMountPath(fixedMountPath ?? '/data/');
    }
    setIsMountPathEditing(false);
  }, [selectedPvcName, fixedMountPath]);

  // ── In-use warning alert ─────────────────────────────────────────────────

  const selectedPvc = useMemo(
    () => availablePVCs.find((p) => p.name === selectedPvcName),
    [availablePVCs, selectedPvcName],
  );

  const inUseAlert = useMemo(() => {
    if (!selectedPvc || !isInUse(selectedPvc)) {
      return null;
    }
    if (isRWO(selectedPvc)) {
      return {
        variant: AlertVariant.danger,
        title: 'Volume is in use with ReadWriteOnce or ReadWriteOncePod access',
        body: 'This volume uses ReadWriteOnce or ReadWriteOncePod access mode and is already mounted. Attaching it to this workspace may fail if it is scheduled on a different node.',
      };
    }
    return {
      variant: AlertVariant.warning,
      title: 'Volume is currently in use',
      body: 'This volume is already mounted by other workspaces or pods. Verify that sharing is supported.',
    };
  }, [selectedPvc]);

  // ── Attach handler ───────────────────────────────────────────────────────

  const handleAttach = useCallback(() => {
    if (!selectedPvc) {
      return;
    }
    const trimmedPath = normalizeMountPath(mountPath);
    if (mountedPaths.has(trimmedPath)) {
      setFormError(`Mount path "${trimmedPath}" is already in use by another volume.`);
      return;
    }
    onAttach(selectedPvc, trimmedPath, readOnly);
  }, [selectedPvc, mountPath, readOnly, mountedPaths, onAttach]);

  // ── Options ──────────────────────────────────────────────────────────────

  const initialOptions = useMemo(
    () => buildPVCSelectOptions(availablePVCs, storageClasses, excludedPvcNames, selectedPvcName),
    [availablePVCs, storageClasses, excludedPvcNames, selectedPvcName],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="VolumesAttachModal"
      aria-labelledby="volumes-attach-modal-title"
      aria-describedby="volumes-attach-modal-body"
      variant={ModalVariant.large}
    >
      <ModalHeader title="Attach Existing Volume" labelId="volumes-attach-modal-title" />
      <ModalBody id="volumes-attach-modal-body">
        <Stack hasGutter>
          {formError && (
            <StackItem>
              <Alert variant={AlertVariant.danger} isInline title="Error">
                {formError}
              </Alert>
            </StackItem>
          )}
          {inUseAlert && (
            <StackItem>
              <Alert variant={inUseAlert.variant} isInline title={inUseAlert.title}>
                {inUseAlert.body}
              </Alert>
            </StackItem>
          )}
          <StackItem>
            <Form>
              <ThemeAwareFormGroupWrapper label="Volume" fieldId="pvc-select">
                <TypeaheadSelect
                  key={selectedPvcName || PVC_SELECT_EMPTY_KEY}
                  id="pvc-select"
                  initialOptions={initialOptions}
                  placeholder="Select a volume"
                  isScrollable
                  maxMenuHeight="25rem"
                  noOptionsFoundMessage={(filter) => `No volume found for "${filter}"`}
                  onSelect={(_ev, value) => {
                    setSelectedPvcName(value as string);
                    setMountPath(fixedMountPath ?? `/data/${value}`);
                    setIsMountPathEditing(false);
                    setFormError('');
                  }}
                  onClearSelection={() => setSelectedPvcName('')}
                />
              </ThemeAwareFormGroupWrapper>
              <MountPathField
                variant="input"
                value={mountPath}
                onChange={(val) => {
                  setMountPath(val);
                  setFormError('');
                }}
                isEditing={isMountPathEditing}
                onStartEdit={handleStartMountPathEdit}
                onConfirm={handleConfirmMountPathEdit}
                onCancel={handleCancelMountPathEdit}
                error={mountPathError}
                isFixed={!!fixedMountPath}
                fieldId="pvc-mount-path"
              />
              <ThemeAwareFormGroupWrapper
                label="Read-only Access"
                fieldId="pvc-read-only"
                skipFieldset
                labelHelp={
                  <Popover
                    headerContent="Read-only access"
                    bodyContent="Mount the volume as read-only when this workspace only needs to read data. This prevents accidental or unintended writes to shared volumes."
                  >
                    <OutlinedQuestionCircleIcon />
                  </Popover>
                }
              >
                <Switch
                  id="pvc-read-only-switch"
                  data-testid="pvc-read-only-switch"
                  label="Enabled"
                  hasCheckIcon
                  isChecked={readOnly}
                  onChange={(_ev, checked) => setReadOnly(checked)}
                />
              </ThemeAwareFormGroupWrapper>
            </Form>
          </StackItem>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button
          key="attach"
          variant="primary"
          isDisabled={
            !selectedPvcName || !mountPath.trim() || !!mountPathError || isMountPathEditing
          }
          onClick={handleAttach}
          data-testid="attach-pvc-button"
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
