import React, { useCallback, useState } from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  Form,
  FormGroup,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { WorkspacePodVolumeMount } from '~/shared/api/backendApiTypes';

interface WorkspaceFormPropertiesVolumesProps {
  volumes: WorkspacePodVolumeMount[];
  setVolumes: (volumes: WorkspacePodVolumeMount[]) => void;
}

export const WorkspaceFormPropertiesVolumes: React.FC<WorkspaceFormPropertiesVolumesProps> = ({
  volumes,
  setVolumes,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<WorkspacePodVolumeMount>({
    pvcName: '',
    mountPath: '',
    readOnly: false,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const resetForm = useCallback(() => {
    setFormData({ pvcName: '', mountPath: '', readOnly: false });
    setEditIndex(null);
    setIsModalOpen(false);
  }, []);

  const handleAddOrEdit = useCallback(() => {
    if (!formData.pvcName || !formData.mountPath) {
      return;
    }
    if (editIndex !== null) {
      const updated = [...volumes];
      updated[editIndex] = formData;
      setVolumes(updated);
    } else {
      setVolumes([...volumes, formData]);
    }
    resetForm();
  }, [formData, editIndex, volumes, setVolumes, resetForm]);

  const handleEdit = useCallback(
    (index: number) => {
      setFormData(volumes[index]);
      setEditIndex(index);
      setIsModalOpen(true);
    },
    [volumes],
  );

  const openDetachModal = useCallback((index: number) => {
    setDeleteIndex(index);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    setVolumes(volumes.filter((_, i) => i !== deleteIndex));
    setIsDeleteModalOpen(false);
    setDeleteIndex(null);
  }, [deleteIndex, volumes, setVolumes]);

  return (
    <>
      {volumes.length > 0 && (
        <Table variant={TableVariant.compact} aria-label="Volumes Table">
          <Thead>
            <Tr>
              <Th>PVC Name</Th>
              <Th>Mount Path</Th>
              <Th>Read-only Access</Th>
              <Th aria-label="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {volumes.map((volume, index) => (
              <Tr key={index}>
                <Td>{volume.pvcName}</Td>
                <Td>{volume.mountPath}</Td>
                <Td>{volume.readOnly ? 'Enabled' : 'Disabled'}</Td>
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
                    <DropdownItem onClick={() => handleEdit(index)}>Edit</DropdownItem>
                    <DropdownItem onClick={() => openDetachModal(index)}>Detach</DropdownItem>
                  </Dropdown>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <Button
        variant="primary"
        onClick={() => setIsModalOpen(true)}
        style={{ marginTop: '1rem' }}
        className="pf-u-mt-md"
      >
        Create Volume
      </Button>

      <Modal isOpen={isModalOpen} onClose={resetForm} variant={ModalVariant.small}>
        <ModalHeader
          title={editIndex !== null ? 'Edit Volume' : 'Create Volume'}
          description="Add a volume and optionally connect it with an existing workspace."
        />
        <ModalBody>
          <Form>
            <FormGroup label="PVC Name" isRequired fieldId="pvc-name">
              <TextInput
                name="pvcName"
                isRequired
                type="text"
                value={formData.pvcName}
                onChange={(_, val) => setFormData({ ...formData, pvcName: val })}
                id="pvc-name"
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
            <FormGroup fieldId="readonly-access">
              <Switch
                id="readonly-access-switch"
                label="Enable read-only access"
                isChecked={formData.readOnly}
                onChange={() => setFormData({ ...formData, readOnly: !formData.readOnly })}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            key="confirm"
            onClick={handleAddOrEdit}
            isDisabled={!formData.pvcName || !formData.mountPath}
          >
            {editIndex !== null ? 'Save' : 'Create'}
          </Button>
          <Button key="cancel" variant="link" onClick={resetForm}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        variant={ModalVariant.small}
      >
        <ModalHeader
          title="Detach Volume?"
          description="The volume and all of its resources will be detached from the workspace."
        />
        <ModalFooter>
          <Button key="detach" variant="danger" onClick={handleDelete}>
            Detach
          </Button>
          <Button key="cancel" variant="link" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default WorkspaceFormPropertiesVolumesProps;
