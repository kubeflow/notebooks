import React, { useCallback, useEffect, useState } from 'react';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableVariant,
} from '@patternfly/react-table/dist/esm/components/Table';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Dropdown, DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { SecretsSecretListItem, WorkspacesPodSecretMount } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { SecretsAttachModal } from './secrets/SecretsAttachModal';
import { SecretsCreateModal } from './secrets/SecretsCreateModal';

interface WorkspaceFormPropertiesSecretsProps {
  secrets: WorkspacesPodSecretMount[];
  setSecrets: (secrets: WorkspacesPodSecretMount[]) => void;
}

const DEFAULT_MODE_OCTAL = (420).toString(8);

export const WorkspaceFormPropertiesSecrets: React.FC<WorkspaceFormPropertiesSecretsProps> = ({
  secrets,
  setSecrets,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<WorkspacesPodSecretMount | undefined>(
    undefined,
  );
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [availableSecrets, setAvailableSecrets] = useState<SecretsSecretListItem[]>([]);
  const [attachedSecrets, setAttachedSecrets] = useState<WorkspacesPodSecretMount[]>([]);
  const [attachedMountPath, setAttachedMountPath] = useState('');
  const [attachedDefaultMode, setAttachedDefaultMode] = useState(DEFAULT_MODE_OCTAL);

  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();

  useEffect(() => {
    const fetchSecrets = async () => {
      const secretsResponse = await api.secrets.listSecrets(selectedNamespace);
      setAvailableSecrets(secretsResponse.data);
    };
    fetchSecrets();
  }, [api.secrets, selectedNamespace]);

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleEdit = useCallback(
    (index: number) => {
      setEditingSecret(secrets[index]);
      setEditIndex(index);
      setIsCreateModalOpen(true);
    },
    [secrets],
  );

  const handleAttachSecrets = useCallback(
    (newSecrets: SecretsSecretListItem[], mountPath: string, mode: number) => {
      const newAttachedSecrets = newSecrets.map((secret) => ({
        secretName: secret.name,
        mountPath,
        defaultMode: mode,
      }));
      const oldAttachedNames = new Set(attachedSecrets.map((s) => s.secretName));
      const secretsWithoutOldAttached = secrets.filter((s) => !oldAttachedNames.has(s.secretName));
      const manualSecretNames = new Set(secretsWithoutOldAttached.map((s) => s.secretName));
      const filteredNewAttached = newAttachedSecrets.filter(
        (s) => !manualSecretNames.has(s.secretName),
      );

      // Update both states
      setAttachedSecrets(filteredNewAttached);
      setSecrets([...secretsWithoutOldAttached, ...filteredNewAttached]);
      setAttachedMountPath(mountPath);
      setAttachedDefaultMode(mode.toString(8));
      setIsAttachModalOpen(false);
    },
    [attachedSecrets, secrets, setSecrets],
  );

  const handleCreateOrEditSubmit = useCallback(
    (secret: WorkspacesPodSecretMount) => {
      if (editIndex !== null) {
        const updated = [...secrets];
        updated[editIndex] = secret;
        setSecrets(updated);
      } else {
        setSecrets([...secrets, secret]);
      }
      setEditingSecret(undefined);
      setEditIndex(null);
      setIsCreateModalOpen(false);
    },
    [editIndex, secrets, setSecrets],
  );

  const handleCreateModalClose = useCallback(() => {
    setEditingSecret(undefined);
    setEditIndex(null);
    setIsCreateModalOpen(false);
  }, []);

  const isAttachedSecret = useCallback(
    (secretName: string) => attachedSecrets.some((s) => s.secretName === secretName),
    [attachedSecrets],
  );

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    const secretToDelete = secrets[deleteIndex];
    setSecrets(secrets.filter((_, i) => i !== deleteIndex));

    // If it's an attached secret, also remove from attachedSecrets
    if (isAttachedSecret(secretToDelete.secretName)) {
      const updatedAttachedSecrets = attachedSecrets.filter(
        (s) => s.secretName !== secretToDelete.secretName,
      );
      setAttachedSecrets(updatedAttachedSecrets);
      if (updatedAttachedSecrets.length === 0) {
        setAttachedMountPath('');
        setAttachedDefaultMode(DEFAULT_MODE_OCTAL);
      }
    }

    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, [deleteIndex, secrets, setSecrets, attachedSecrets, isAttachedSecret]);

  return (
    <>
      {secrets.length > 0 && (
        <Table variant={TableVariant.compact} aria-label="Secrets Table">
          <Thead>
            <Tr>
              <Th>Secret Name</Th>
              <Th>Mount Path</Th>
              <Th>Default Mode</Th>
              <Th aria-label="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {secrets.map((secret, index) => (
              <Tr key={index}>
                <Td>{secret.secretName}</Td>
                <Td>{secret.mountPath}</Td>
                <Td>{secret.defaultMode?.toString(8) ?? DEFAULT_MODE_OCTAL}</Td>
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
                    {!isAttachedSecret(secret.secretName) && (
                      <DropdownItem onClick={() => handleEdit(index)}>Edit</DropdownItem>
                    )}
                    <DropdownItem onClick={() => openDeleteModal(index)}>Remove</DropdownItem>
                  </Dropdown>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <Button
        variant="secondary"
        onClick={() => setIsAttachModalOpen(true)}
        style={{ marginTop: '1rem', marginRight: '1rem', width: 'fit-content' }}
      >
        Attach Existing Secrets
      </Button>
      <Button
        variant="secondary"
        onClick={() => setIsCreateModalOpen(true)}
        style={{ marginTop: '1rem', width: 'fit-content' }}
      >
        Create Secret
      </Button>
      <SecretsAttachModal
        availableSecrets={availableSecrets}
        isOpen={isAttachModalOpen}
        setIsOpen={setIsAttachModalOpen}
        selectedSecrets={attachedSecrets.map((secret) => secret.secretName)}
        onClose={handleAttachSecrets}
        initialMountPath={attachedMountPath}
        initialDefaultMode={attachedDefaultMode}
      />
      <SecretsCreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={handleCreateModalClose}
        onSubmit={handleCreateOrEditSubmit}
        editSecret={editingSecret}
      />
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

export default WorkspaceFormPropertiesSecrets;
