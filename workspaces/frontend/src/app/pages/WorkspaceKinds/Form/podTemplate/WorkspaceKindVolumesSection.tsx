import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Dropdown, DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import {
  Table,
  TableVariant,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@patternfly/react-table/dist/esm/components/Table';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { WorkspacesPodVolumeMount } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

interface WorkspaceKindVolumesSectionProps {
  volumes: WorkspacesPodVolumeMount[];
  setVolumes: (volumes: WorkspacesPodVolumeMount[]) => void;
}

export const WorkspaceKindVolumesSection: React.FC<WorkspaceKindVolumesSectionProps> = ({
  volumes,
  setVolumes,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [pvcName, setPvcName] = useState('');
  const [mountPath, setMountPath] = useState('');
  const [readOnly, setReadOnly] = useState(false);

  const [isDetachModalOpen, setIsDetachModalOpen] = useState(false);
  const [detachIndex, setDetachIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const openCreateModal = useCallback(() => {
    setEditIndex(null);
    setPvcName('');
    setMountPath('');
    setReadOnly(false);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback(
    (index: number) => {
      const vol = volumes[index];
      setEditIndex(index);
      setPvcName(vol.pvcName);
      setMountPath(vol.mountPath);
      setReadOnly(vol.readOnly ?? false);
      setDropdownOpen(null);
      setIsModalOpen(true);
    },
    [volumes],
  );

  const handleSubmit = useCallback(() => {
    const entry: WorkspacesPodVolumeMount = { pvcName, mountPath, readOnly };
    if (editIndex !== null) {
      const updated = [...volumes];
      updated[editIndex] = entry;
      setVolumes(updated);
    } else {
      setVolumes([...volumes, entry]);
    }
    setIsModalOpen(false);
  }, [pvcName, mountPath, readOnly, editIndex, volumes, setVolumes]);

  const openDetachModal = useCallback((index: number) => {
    setDetachIndex(index);
    setDropdownOpen(null);
    setIsDetachModalOpen(true);
  }, []);

  const handleDetachConfirm = useCallback(() => {
    if (detachIndex !== null) {
      setVolumes(volumes.filter((_, i) => i !== detachIndex));
    }
    setIsDetachModalOpen(false);
    setDetachIndex(null);
  }, [detachIndex, volumes, setVolumes]);

  const isSubmitDisabled = !pvcName.trim() || !mountPath.trim();

  const createButton = (
    <Button variant="secondary" onClick={openCreateModal} data-testid="create-volume-button">
      Create Volume
    </Button>
  );

  return (
    <>
      {volumes.length === 0 ? (
        <EmptyState
          titleText="No volumes configured"
          headingLevel="h4"
          icon={PlusCircleIcon}
          data-testid="volumes-empty-state"
        >
          <EmptyStateBody>Add a volume mount to this workspace kind.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>{createButton}</EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <>
          <Table
            variant={TableVariant.compact}
            aria-label="Volumes Table"
            data-testid="volumes-table"
          >
            <Thead>
              <Tr>
                <Th>PVC Name</Th>
                <Th>Mount Path</Th>
                <Th>Read-only</Th>
                <Th aria-label="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {volumes.map((vol, index) => (
                <Tr key={index}>
                  <Td>{vol.pvcName}</Td>
                  <Td>{vol.mountPath}</Td>
                  <Td>{vol.readOnly ? 'Enabled' : 'Disabled'}</Td>
                  <Td isActionCell>
                    <Dropdown
                      toggle={(toggleRef) => (
                        <MenuToggle
                          ref={toggleRef}
                          isExpanded={dropdownOpen === index}
                          onClick={() => setDropdownOpen(dropdownOpen === index ? null : index)}
                          variant="plain"
                          aria-label="plain kebab"
                        >
                          <EllipsisVIcon />
                        </MenuToggle>
                      )}
                      isOpen={dropdownOpen === index}
                      onSelect={() => setDropdownOpen(null)}
                      popperProps={{ position: 'right' }}
                    >
                      <DropdownItem onClick={() => openEditModal(index)}>Edit</DropdownItem>
                      <DropdownItem onClick={() => openDetachModal(index)}>Detach</DropdownItem>
                    </Dropdown>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <div style={{ marginTop: '1rem' }}>{createButton}</div>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        variant={ModalVariant.small}
        data-testid="volume-modal"
        aria-labelledby="volume-modal-title"
      >
        <ModalHeader
          title={editIndex !== null ? 'Edit Volume' : 'Create Volume'}
          labelId="volume-modal-title"
        />
        <ModalBody>
          <Form>
            <ThemeAwareFormGroupWrapper label="PVC Name" isRequired fieldId="vm-pvc-name">
              <TextInput
                id="vm-pvc-name"
                data-testid="pvc-name-input"
                isRequired
                type="text"
                value={pvcName}
                onChange={(_, val) => setPvcName(val)}
              />
            </ThemeAwareFormGroupWrapper>
            <ThemeAwareFormGroupWrapper label="Mount Path" isRequired fieldId="vm-mount-path">
              <TextInput
                id="vm-mount-path"
                data-testid="mount-path-input"
                isRequired
                type="text"
                value={mountPath}
                onChange={(_, val) => setMountPath(val)}
              />
            </ThemeAwareFormGroupWrapper>
            <FormGroup fieldId="vm-read-only">
              <Switch
                id="vm-read-only-switch"
                data-testid="readonly-access-switch"
                label="Read-only access"
                isChecked={readOnly}
                onChange={(_, checked) => setReadOnly(checked)}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isDisabled={isSubmitDisabled}
            data-testid="volume-modal-submit-button"
          >
            {editIndex !== null ? 'Save' : 'Create'}
          </Button>
          <Button
            variant="link"
            onClick={() => setIsModalOpen(false)}
            data-testid="volume-modal-cancel-button"
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {detachIndex !== null && (
        <Modal
          isOpen={isDetachModalOpen}
          onClose={() => setIsDetachModalOpen(false)}
          variant={ModalVariant.small}
          data-testid="detach-volume-modal"
          aria-labelledby="detach-volume-modal-title"
        >
          <ModalHeader title="Detach Volume?" labelId="detach-volume-modal-title" />
          <ModalBody>
            Are you sure you want to detach <strong>{volumes[detachIndex]?.pvcName}</strong>?
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              onClick={handleDetachConfirm}
              data-testid="detach-volume-confirm-button"
            >
              Detach
            </Button>
            <Button
              variant="link"
              onClick={() => setIsDetachModalOpen(false)}
              data-testid="detach-volume-cancel-button"
            >
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};
