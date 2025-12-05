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
import { SecretsApiCreateModal } from './secrets/SecretsApiCreateModal';

interface WorkspaceFormPropertiesSecretsProps {
  secrets: WorkspacesPodSecretMount[];
  setSecrets: (secrets: WorkspacesPodSecretMount[]) => void;
}

export const WorkspaceFormPropertiesSecrets: React.FC<WorkspaceFormPropertiesSecretsProps> = ({
  secrets,
  setSecrets,
}) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();

  const [isApiCreateModalOpen, setIsApiCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  // Keep baseline secrets fetching from PR #698 for future attach functionality
  const [, setAvailableSecrets] = useState<SecretsSecretListItem[]>([]);

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

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    setSecrets(secrets.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, [deleteIndex, secrets, setSecrets]);

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
        variant="primary"
        onClick={() => setIsApiCreateModalOpen(true)}
        style={{ width: 'fit-content' }}
      >
        Create New Secret
      </Button>

      {/* <SecretsAttachModal
        isOpen={isAttachModalOpen}
        setIsOpen={setIsAttachModalOpen}
        onClose={handleAttachSecrets}
        selectedSecrets={selectedSecretNames}
        availableSecrets={availableSecrets}
        initialMountPath={attachedMountPath}
        initialDefaultMode={attachedDefaultMode}
      /> */}

      <SecretsApiCreateModal
        isOpen={isApiCreateModalOpen}
        setIsOpen={setIsApiCreateModalOpen}
        onSecretCreated={handleSecretCreated}
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
