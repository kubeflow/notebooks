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
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { SecretsSecretListItem, WorkspacesPodSecretMount } from '~/generated/data-contracts';
import { DEFAULT_MODE } from '~/app/pages/Workspaces/Form/helpers';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { SecretsCreateModal } from './secrets/SecretsCreateModal';
import { SecretsAttachModal } from './secrets/SecretsAttachModal';
import { SecretsViewPopover } from './secrets/SecretsViewPopover';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [availableSecrets, setAvailableSecrets] = useState<SecretsSecretListItem[]>([]);
  const [attachedSecretKeys, setAttachedSecretKeys] = useState<Set<string>>(new Set());
  const [secretToEdit, setSecretToEdit] = useState<SecretsSecretListItem | undefined>(undefined);

  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  useEffect(() => {
    const fetchSecrets = async () => {
      try {
        const secretsResponse = await api.secrets.listSecrets(selectedNamespace);
        setAvailableSecrets(secretsResponse.data);
      } catch {
        // Secrets list unavailable - user can still create new secrets
      }
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
    async (secretName: string) => {
      // Check if secret is already in the list
      const existingSecret = secrets.find((s) => s.secretName === secretName);
      if (existingSecret) {
        return;
      }

      // Add the newly created secret to the table with default mount path and mode
      const newSecret: WorkspacesPodSecretMount = {
        secretName,
        mountPath: `/secrets/${secretName}`,
        defaultMode: DEFAULT_MODE,
      };

      setSecrets([...secrets, newSecret]);

      // Refresh the available secrets list to get the new secret's details (including immutable status)
      const secretsResponse = await api.secrets.listSecrets(selectedNamespace);
      setAvailableSecrets(secretsResponse.data);
    },
    [secrets, setSecrets, api.secrets, selectedNamespace],
  );

  const openEditModal = useCallback(
    (secretName: string) => {
      // Find the secret in available secrets to get full details
      const secret = availableSecrets.find((s) => s.name === secretName);

      // Create a minimal secret object if not found (modal will fetch full details)
      const secretData = secret ?? {
        name: secretName,
        type: 'Opaque',
        immutable: false,
        canMount: true,
        canUpdate: true,
        audit: { createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: '' },
      };

      // Set open first, then data (matching delete modal pattern)
      setIsEditModalOpen(true);
      setSecretToEdit(secretData);
    },
    [availableSecrets],
  );

  const handleSecretUpdated = useCallback(async () => {
    // Refresh the available secrets list to get updated data
    const secretsResponse = await api.secrets.listSecrets(selectedNamespace);
    setAvailableSecrets(secretsResponse.data);
    setSecretToEdit(undefined);
    setIsEditModalOpen(false);
  }, [api.secrets, selectedNamespace]);

  const handleEditModalClose = useCallback((isOpen: boolean) => {
    setIsEditModalOpen(isOpen);
    if (!isOpen) {
      setSecretToEdit(undefined);
    }
  }, []);

  return (
    <>
      {secrets.length > 0 && (
        <Table
          variant={TableVariant.compact}
          aria-label="Secrets Table"
          data-testid="secrets-table"
        >
          <Thead>
            <Tr>
              <Th>Secret Name</Th>
              <Th>Mount Path</Th>
              <Th>Default Mode</Th>
              <Th aria-label="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {secrets.map((secret, index) => {
              const secretDetails = availableSecrets.find((s) => s.name === secret.secretName);
              const isImmutable = secretDetails?.immutable ?? false;

              return (
                <Tr key={secret.secretName}>
                  <Td>
                    <Flex
                      spaceItems={{ default: 'spaceItemsSm' }}
                      alignItems={{ default: 'alignItemsCenter' }}
                    >
                      <FlexItem>
                        {secret.secretName} <SecretsViewPopover secretName={secret.secretName} />
                      </FlexItem>
                      {isImmutable && (
                        <FlexItem>
                          <Label color="orange" isCompact>
                            Immutable
                          </Label>
                        </FlexItem>
                      )}
                    </Flex>
                  </Td>
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
                          aria-label="Actions"
                          data-testid={`secret-kebab-${secret.secretName}`}
                        >
                          <EllipsisVIcon />
                        </MenuToggle>
                      )}
                      isOpen={dropdownOpen === index}
                      onSelect={() => setDropdownOpen(null)}
                      onOpenChange={(isOpen) => setDropdownOpen(isOpen ? index : null)}
                      popperProps={{ position: 'right' }}
                    >
                      {isImmutable ? (
                        <Tooltip content="This secret is immutable and cannot be edited.">
                          <DropdownItem
                            isAriaDisabled
                            data-testid={`edit-secret-${secret.secretName}`}
                          >
                            Edit
                          </DropdownItem>
                        </Tooltip>
                      ) : (
                        <DropdownItem
                          onClick={() => openEditModal(secret.secretName)}
                          data-testid={`edit-secret-${secret.secretName}`}
                        >
                          Edit
                        </DropdownItem>
                      )}
                      <DropdownItem
                        onClick={() => openDeleteModal(index)}
                        data-testid={`remove-secret-${secret.secretName}`}
                      >
                        Remove
                      </DropdownItem>
                    </Dropdown>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
      <Button
        variant="secondary"
        onClick={() => setIsAttachModalOpen(true)}
        className="pf-v6-u-mt-md pf-v6-u-mr-md"
        data-testid="attach-secrets-button"
      >
        Attach Existing Secrets
      </Button>
      <Button
        variant="secondary"
        onClick={() => setIsCreateModalOpen(true)}
        className="pf-v6-u-mt-md"
        data-testid="create-secret-button"
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

      <SecretsCreateModal
        isOpen={isEditModalOpen}
        setIsOpen={handleEditModalClose}
        secretToEdit={secretToEdit}
        onSecretUpdated={handleSecretUpdated}
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
