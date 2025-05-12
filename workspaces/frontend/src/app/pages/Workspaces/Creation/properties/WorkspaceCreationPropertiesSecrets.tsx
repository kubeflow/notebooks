import React, { useCallback, useState } from 'react';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td, TableVariant } from '@patternfly/react-table';
import {
  Button,
  Modal,
  ModalVariant,
  TextInput,
  Dropdown,
  DropdownItem,
  MenuToggle,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  ModalHeader,
  ValidatedOptions,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { WorkspaceSecret } from '~/shared/types';

interface WorkspaceCreationPropertiesSecretsProps {
  secrets: WorkspaceSecret[];
  setSecrets: React.Dispatch<React.SetStateAction<WorkspaceSecret[]>>;
}

export const WorkspaceCreationPropertiesSecrets: React.FC<
  WorkspaceCreationPropertiesSecretsProps
> = ({ secrets, setSecrets }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<WorkspaceSecret>({
    secretName: '',
    mountPath: '',
    defaultMode: 420,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [defaultMode, setDefaultMode] = useState('644');
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [isDefaultModeValid, setIsDefaultModeValid] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleEdit = useCallback(
    (index: number) => {
      setFormData(secrets[index]);
      setDefaultMode(secrets[index].defaultMode.toString(8));
      setEditIndex(index);
      setIsModalOpen(true);
    },
    [secrets],
  );

  const handleDefaultModeInput = useCallback(
    (val: string) => {
      if (val.length <= 3) {
        // 0 no permissions, 4 read only, 5 read + execute, 6 read + write, 7 all permissions
        setDefaultMode(val);
        const permissions = ['0', '4', '5', '6', '7'];
        const isValid = Array.from(val).every((char) => permissions.includes(char));
        if (val.length < 3 || !isValid) {
          setIsDefaultModeValid(false);
        } else {
          setIsDefaultModeValid(true);
        }
        const decimalVal = parseInt(val, 8);
        setFormData({ ...formData, defaultMode: decimalVal });
      }
    },
    [setFormData, setIsDefaultModeValid, setDefaultMode, formData],
  );

  const clearForm = useCallback(() => {
    setFormData({ secretName: '', mountPath: '', defaultMode: 420 });
    setEditIndex(null);
    setIsModalOpen(false);
    setIsDefaultModeValid(true);
  }, []);

  const handleAddOrEditSubmit = useCallback(() => {
    setSecrets((prev) => {
      if (editIndex === null) {
        return [...prev, formData];
      }
      const updated = prev;
      updated[editIndex] = formData;
      return updated;
    });
    clearForm();
  }, [editIndex, setSecrets, clearForm, formData]);

  const handleDelete = useCallback(() => {
    if (deleteIndex !== null) {
      setSecrets((prev) => {
        prev.splice(deleteIndex, 1);
        return prev;
      });
      setDeleteIndex(null);
      setIsDeleteModalOpen(false);
    }
  }, [setSecrets, deleteIndex]);

  return (
    <>
      {secrets.length > 0 && (
        <Table variant={TableVariant.compact} aria-label="Secrets Table">
          <Thead>
            <Tr>
              <Th>Secret Name</Th>
              <Th>Mount Path</Th>
              <Th>Default Mode</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {secrets.map((secret, index) => (
              <Tr key={index}>
                <Td>{secret.secretName}</Td>
                <Td>{secret.mountPath}</Td>
                <Td>{secret.defaultMode.toString(8)}</Td>
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
                    <DropdownItem onClick={() => openDeleteModal(index)}>Remove</DropdownItem>
                  </Dropdown>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <Button variant="primary" onClick={() => setIsModalOpen(true)} style={{ marginTop: '1rem' }}>
        Create Secret
      </Button>
      <Modal isOpen={isModalOpen} onClose={clearForm} variant={ModalVariant.small}>
        <ModalHeader
          title={editIndex === null ? 'Create Secret' : 'Edit Secret'}
          labelId="secret-modal-title"
          description={
            editIndex === null
              ? 'Add a secret to securely use API keys, tokens, or other credentials in your workspace.'
              : ''
          }
        />
        <ModalBody id="secret-modal-box-body">
          <Form onSubmit={handleAddOrEditSubmit}>
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
            onClick={handleAddOrEditSubmit}
            isDisabled={!isDefaultModeValid}
          >
            {editIndex !== null ? 'Save' : 'Create'}
          </Button>
          <Button key="cancel" variant="link" onClick={clearForm}>
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
          title="Remove Secret?"
          description="The secret will be removed from the workspace."
        />
        <ModalFooter>
          <Button key="remove" variant="danger" onClick={handleDelete}>
            Remove
          </Button>
          <Button key="cancel" variant="link" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default WorkspaceCreationPropertiesSecrets;
