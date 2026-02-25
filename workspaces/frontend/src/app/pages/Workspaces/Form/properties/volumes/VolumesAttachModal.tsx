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
import { TypeaheadSelect, TypeaheadSelectOption } from '@patternfly/react-templates';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { CubeIcon } from '@patternfly/react-icons/dist/esm/icons/cube-icon';
import { PvcsPVCListItem } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

export interface VolumesAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAttach: (pvc: PvcsPVCListItem, mountPath: string, readOnly: boolean) => void;
  availablePVCs: PvcsPVCListItem[];
  /** Set of mount paths already in use across all attached volumes */
  mountedPaths: Set<string>;
}

const isRWO = (pvc: PvcsPVCListItem): boolean =>
  pvc.pvcSpec.accessModes.includes('ReadWriteOnce') &&
  !pvc.pvcSpec.accessModes.includes('ReadWriteMany');

const isInUse = (pvc: PvcsPVCListItem): boolean => pvc.pods.length > 0 || pvc.workspaces.length > 0;

export const VolumesAttachModal: React.FC<VolumesAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
  availablePVCs,
  mountedPaths,
}) => {
  const [selectedPvcName, setSelectedPvcName] = useState<string>('');
  const [mountPath, setMountPath] = useState('/data/');
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedPvcName('');
      setMountPath('/data/');
      setReadOnly(false);
      setError('');
    }
  }, [isOpen]);

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
        title: 'PVC is in use with ReadWriteOnce access',
        body: 'This PVC uses ReadWriteOnce access mode and is already mounted on a node. Attaching it to this workspace may fail if it is scheduled on a different node.',
      };
    }
    return {
      variant: AlertVariant.warning,
      title: 'PVC is currently in use',
      body: 'This PVC is already mounted by other workspaces or pods. Verify that sharing is supported by its access mode.',
    };
  }, [selectedPvc]);

  const handleAttach = useCallback(() => {
    if (!selectedPvc) {
      return;
    }
    const trimmedPath = mountPath.trim().replace(/\/+$/, '');

    if (mountedPaths.has(trimmedPath)) {
      setError(`Mount path "${trimmedPath}" is already in use by another volume.`);
      return;
    }

    onAttach(selectedPvc, trimmedPath, readOnly);
  }, [selectedPvc, mountPath, readOnly, mountedPaths, onAttach]);

  const initialOptions = useMemo<TypeaheadSelectOption[]>(
    () =>
      availablePVCs.map((pvc) => {
        const inUse = isInUse(pvc);
        const rwo = isRWO(pvc);

        return {
          content: pvc.name,
          value: pvc.name,
          isDisabled: !pvc.canMount,
          description: (
            <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
              <FlexItem>
                <Stack>
                  <StackItem>
                    <LabelGroup>
                      <Label isCompact>{pvc.pvcSpec.requests.storage}</Label>
                      <Label isCompact variant="outline">
                        {pvc.pvcSpec.storageClassName}
                      </Label>
                      {pvc.pvcSpec.accessModes.map((mode) => (
                        <Label
                          key={mode}
                          isCompact
                          color={mode === 'ReadWriteOnce' ? 'blue' : 'green'}
                        >
                          {mode}
                        </Label>
                      ))}
                      {inUse && rwo && (
                        <Label isCompact color="red">
                          In use (RWO)
                        </Label>
                      )}
                      {inUse && !rwo && (
                        <Label isCompact color="orange">
                          In use
                        </Label>
                      )}
                      {!pvc.canMount && <Label isCompact>Unmountable</Label>}
                    </LabelGroup>
                  </StackItem>
                  {pvc.workspaces.length > 0 && (
                    <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
                      <Flex gap={{ default: 'gapXs' }}>
                        <FlexItem>Workspaces:</FlexItem>
                        <FlexItem>
                          <LabelGroupWithTooltip
                            labels={pvc.workspaces.map((w) => w.name)}
                            limit={3}
                            variant="outline"
                            icon={<CubeIcon color="teal" />}
                            isCompact
                            color="teal"
                          />
                        </FlexItem>
                      </Flex>
                    </StackItem>
                  )}
                  {pvc.pods.length > 0 && (
                    <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
                      <Flex gap={{ default: 'gapXs' }}>
                        <FlexItem>Pods:</FlexItem>
                        <FlexItem>
                          <LabelGroupWithTooltip
                            labels={pvc.pods.map((pod) => pod.name)}
                            limit={3}
                            variant="outline"
                            isCompact
                          />
                        </FlexItem>
                      </Flex>
                    </StackItem>
                  )}
                </Stack>
              </FlexItem>
              <FlexItem>
                <Tooltip
                  aria="none"
                  aria-live="polite"
                  content={
                    <Stack>
                      <StackItem>
                        {`Created at: ${new Date(pvc.audit.createdAt).toLocaleString()} by ${pvc.audit.createdBy}`}
                      </StackItem>
                      <StackItem>
                        {`Updated at: ${new Date(pvc.audit.updatedAt).toLocaleString()} by ${pvc.audit.updatedBy}`}
                      </StackItem>
                    </Stack>
                  }
                >
                  <span style={{ cursor: 'default' }}>
                    <InfoCircleIcon />
                  </span>
                </Tooltip>
              </FlexItem>
            </Flex>
          ),
        };
      }),
    [availablePVCs],
  );

  const isAttachDisabled = !selectedPvcName || !mountPath.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="VolumesAttachModal"
      aria-labelledby="volumes-attach-modal-title"
      aria-describedby="volumes-attach-modal-body"
      variant={ModalVariant.large}
    >
      <ModalHeader title="Attach Existing PVC" labelId="volumes-attach-modal-title" />
      <ModalBody id="volumes-attach-modal-body">
        <Stack hasGutter>
          {error && (
            <StackItem>
              <Alert variant={AlertVariant.danger} isInline title="Error">
                {error}
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
              <ThemeAwareFormGroupWrapper label="PVC" fieldId="pvc-select">
                <TypeaheadSelect
                  initialOptions={initialOptions}
                  maxMenuHeight="15rem"
                  isScrollable
                  id="pvc-select"
                  placeholder="Select a PVC"
                  noOptionsFoundMessage={(filter) => `No PVC found for "${filter}"`}
                  onSelect={(_ev, selection) => {
                    setSelectedPvcName(selection as string);
                    setMountPath(`/data/${selection}`);
                    setError('');
                  }}
                  onClearSelection={() => {
                    setSelectedPvcName('');
                    setError('');
                  }}
                />
              </ThemeAwareFormGroupWrapper>
              <ThemeAwareFormGroupWrapper label="Mount Path" isRequired fieldId="pvc-mount-path">
                <TextInput
                  name="mountPath"
                  isRequired
                  type="text"
                  id="pvc-mount-path"
                  value={mountPath}
                  onChange={(_, val) => {
                    setMountPath(val);
                    setError('');
                  }}
                  placeholder="/data/my-volume"
                />
              </ThemeAwareFormGroupWrapper>
              <FormGroup fieldId="pvc-read-only" className="pf-v6-u-pt-sm">
                <Switch
                  id="pvc-read-only-switch"
                  label="Read-only access"
                  isChecked={readOnly}
                  onChange={(_ev, checked) => setReadOnly(checked)}
                  data-testid="pvc-read-only-switch"
                />
              </FormGroup>
            </Form>
          </StackItem>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button
          key="attach"
          variant="primary"
          isDisabled={isAttachDisabled}
          onClick={handleAttach}
          data-testid="attach-pvc-button"
        >
          Attach Existing PVC
        </Button>
        <Button key="cancel" variant="link" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
