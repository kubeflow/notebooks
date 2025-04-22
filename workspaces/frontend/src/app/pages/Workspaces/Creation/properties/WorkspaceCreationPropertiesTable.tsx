import React, { useState } from 'react';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td, TableVariant } from '@patternfly/react-table';
import {
  Button,
  Modal,
  ModalVariant,
  TextInput,
  Switch,
  Dropdown,
  DropdownItem,
  MenuToggle,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
} from '@patternfly/react-core';

interface Volume {
  pvcName: string;
  mountPath: string;
  readOnly: boolean;
}

interface WorkspaceCreationPropertiesTableProps {
  volumes: Volume[];
  setVolumes: React.Dispatch<React.SetStateAction<Volume[]>>;
}

export const WorkspaceCreationPropertiesTable: React.FC<WorkspaceCreationPropertiesTableProps> = ({
  volumes,
  setVolumes,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<Volume>({ pvcName: '', mountPath: '', readOnly: false });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const handleAddOrEdit = () => {
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
  };

  const handleEdit = (index: number) => {
    setFormData(volumes[index]);
    setEditIndex(index);
    setIsModalOpen(true);
  };

  const openDetachModal = (index: number) => {
    setDeleteIndex(index);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (deleteIndex !== null) {
      setVolumes(volumes.filter((_, i) => i !== deleteIndex));
      setIsDeleteModalOpen(false);
      setDeleteIndex(null);
    }
  };

  const resetForm = () => {
    setFormData({ pvcName: '', mountPath: '', readOnly: false });
    setEditIndex(null);
    setIsModalOpen(false);
  };

  return (
    <>
      {volumes.length > 0 && (
        <Table variant={TableVariant.compact} aria-label="Volumes Table">
          <Thead>
            <Tr>
              <Th>PVC Name</Th>
              <Th>Mount Path</Th>
              <Th>Read Only</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {volumes.map((volume, index) => (
              <Tr key={index}>
                <Td>{volume.pvcName}</Td>
                <Td>{volume.mountPath}</Td>
                <Td>
                  <Switch
                    id={`readonly-switch-${index}`}
                    isChecked={volume.readOnly}
                    onChange={() => {
                      const updated = [...volumes];
                      updated[index].readOnly = !updated[index].readOnly;
                      setVolumes(updated);
                    }}
                  />
                </Td>
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

      <Modal
        title={editIndex !== null ? 'Edit Volume' : 'Create Volume'}
        isOpen={isModalOpen}
        onClose={resetForm}
        variant={ModalVariant.small}
      >
        <ModalBody>
          <div> Add volume and optionally connect it with an existing workspace.</div>
          <div className="pf-u-font-size-sm" />
          <div className="pf-c-form">
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
            </Form>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            key="confirm"
            onClick={handleAddOrEdit}
            isDisabled={!formData.pvcName || !formData.mountPath}
          >
            {editIndex !== null ? 'Save' : 'Add'}
          </Button>
          <Button key="cancel" variant="link" onClick={resetForm}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        title="Detach PVC?"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        variant={ModalVariant.small}
      >
        <ModalBody>
          <div> The volume and all of its resources will be detached from the workspace.</div>
        </ModalBody>
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

export default WorkspaceCreationPropertiesTable;
