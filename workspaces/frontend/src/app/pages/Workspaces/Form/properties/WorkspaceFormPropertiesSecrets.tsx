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
import { SecretsCreateModal } from './secrets/SecretsCreateModal';
import { SecretsAttachModal } from './secrets/SecretsAttachModal';

interface WorkspaceFormPropertiesSecretsProps {
  secrets: WorkspacesPodSecretMount[];
  setSecrets: (secrets: WorkspacesPodSecretMount[]) => void;
}

export const WorkspaceFormPropertiesSecrets: React.FC<WorkspaceFormPropertiesSecretsProps> = ({
  secrets,
  setSecrets,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [availableSecrets, setAvailableSecrets] = useState<SecretsSecretListItem[]>([]);
  const [attachedSecretKeys, setAttachedSecretKeys] = useState<Set<string>>(new Set());

  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();

  useEffect(() => {
    const fetchSecrets = async () => {
      const secretsResponse = await api.secrets.listSecrets(selectedNamespace);
      setAvailableSecrets(secretsResponse.data);
    };
    fetchSecrets();
  }, [api.secrets, selectedNamespace]);

  const getSecretKey = (secret: WorkspacesPodSecretMount): string =>
    `${secret.secretName}:${secret.mountPath}`;

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleAttachSecrets = useCallback(
    (newSecrets: SecretsSecretListItem[], mountPath: string, mode: number) => {
      const newSecretMounts = newSecrets.map((secret) => ({
        secretName: secret.name,
        mountPath,
        defaultMode: mode,
      }));

      // Track the keys of attached secrets
      const newKeys = new Set(attachedSecretKeys);
      newSecretMounts.forEach((mount) => {
        newKeys.add(getSecretKey(mount));
      });
      setAttachedSecretKeys(newKeys);

      setSecrets([...secrets, ...newSecretMounts]);
      setIsAttachModalOpen(false);
    },
    [secrets, setSecrets, attachedSecretKeys],
  );

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    const secretToDelete = secrets[deleteIndex];

    // Remove from attached keys if it was attached
    if (attachedSecretKeys.has(getSecretKey(secretToDelete))) {
      const newKeys = new Set(attachedSecretKeys);
      newKeys.delete(getSecretKey(secretToDelete));
      setAttachedSecretKeys(newKeys);
    }

    setSecrets(secrets.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, [deleteIndex, secrets, setSecrets, attachedSecretKeys]);

  const handleSecretCreated = useCallback(
    (secretName: string) => {
      // Check if secret is already in the list
      const existingSecret = secrets.find((s) => s.secretName === secretName);
      if (existingSecret) {
        return;
      }

      // Add the newly created secret to the table with default mount path and mode
      const newSecret: WorkspacesPodSecretMount = {
        secretName,
        mountPath: `/secrets/${secretName}`,
        defaultMode: 420, // 0644 in octal, default as per backend validation
      };

      setSecrets([...secrets, newSecret]);
    },
    [secrets, setSecrets],
  );

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
                <Td>{secret.defaultMode?.toString(8) ?? '644'}</Td>
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
        Create New Secret
      </Button>

      <SecretsAttachModal
        availableSecrets={availableSecrets}
        isOpen={isAttachModalOpen}
        setIsOpen={setIsAttachModalOpen}
        onAttach={handleAttachSecrets}
        existingSecretKeys={attachedSecretKeys}
      />

      <SecretsCreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        onSecretCreated={handleSecretCreated}
        existingSecretNames={secrets.map((s) => s.secretName)}
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
