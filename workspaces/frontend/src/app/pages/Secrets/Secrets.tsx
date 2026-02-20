import React, { useState, useCallback } from 'react';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  TableVariant,
  ActionsColumn,
  IActions,
} from '@patternfly/react-table/dist/esm/components/Table';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core/dist/esm/components/Toolbar';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { useSecretsByNamespace } from '~/app/hooks/useSecrets';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { LoadError } from '~/app/components/LoadError';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { SecretsCreateModal } from '~/app/pages/Workspaces/Form/properties/secrets/SecretsCreateModal';
import { SecretsViewPopover } from '~/app/pages/Workspaces/Form/properties/secrets/SecretsViewPopover';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

export const Secrets: React.FunctionComponent = () => {
  const { selectedNamespace } = useNamespaceSelectorWrapper();
  const [secrets, secretsLoaded, secretsError, refreshSecrets] =
    useSecretsByNamespace(selectedNamespace);
  const { api } = useNotebookAPI();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeSecret, setActiveSecret] = useState<SecretsSecretListItem | undefined>(undefined);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleCreateSecret = () => {
    setActiveSecret(undefined);
    setIsCreateModalOpen(true);
  };

  const handleEditSecret = (secret: SecretsSecretListItem) => {
    setActiveSecret(secret);
    setIsEditModalOpen(true);
  };

  const handleDeleteSecret = (secret: SecretsSecretListItem) => {
    setActiveSecret(secret);
    setIsDeleteModalOpen(true);
  };

  const onSecretCreatedOrUpdated = useCallback(() => {
    refreshSecrets();
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
  }, [refreshSecrets]);

  const confirmDelete = async () => {
    if (!activeSecret) {
      return;
    }
    setDeleteLoading(true);
    try {
      await api.secrets.deleteSecret(selectedNamespace, activeSecret.name);
      refreshSecrets();
      setIsDeleteModalOpen(false);
    } catch (err) {
      // Handle error (maybe show notification)
      console.error(err);
    } finally {
      setDeleteLoading(false);
      setActiveSecret(undefined);
    }
  };

  const columns = ['Name', 'Type', 'Immutable', 'Created At', 'Mounted By'];

  const getRowActions = (secret: SecretsSecretListItem): IActions => {
    const actions: IActions = [];

    if (secret.canUpdate) {
      actions.push({
        title: 'Edit',
        onClick: () => handleEditSecret(secret),
      });
    }

    // Assuming we can delete if we can update, or strictly if not mounted?
    // For now allowing delete if canUpdate is true, similar to other resources.
    if (secret.canUpdate) {
      actions.push({
        title: 'Delete',
        onClick: () => handleDeleteSecret(secret),
      });
    }

    return actions;
  };

  if (secretsError) {
    return <LoadError title="Failed to load secrets" error={secretsError} />;
  }

  if (!secretsLoaded) {
    return (
      <Bullseye>
        <Spinner />
      </Bullseye>
    );
  }

  return (
    <PageSection>
      <Title headingLevel="h1" size="2xl">
        Secrets
      </Title>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" onClick={handleCreateSecret}>
              Create Secret
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {secrets.length === 0 ? (
        <EmptyState
          variant={EmptyStateVariant.full}
          icon={CubesIcon}
          titleText="No secrets found"
          headingLevel="h5"
        >
          <EmptyStateBody>No secrets are currently available in this namespace.</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Secrets table" variant={TableVariant.compact}>
          <Thead>
            <Tr>
              {columns.map((column, columnIndex) => (
                <Th key={columnIndex}>{column}</Th>
              ))}
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {secrets.map((secret: SecretsSecretListItem, rowIndex: number) => (
              <Tr key={rowIndex}>
                <Td dataLabel={columns[0]}>
                  {secret.name} <SecretsViewPopover secretName={secret.name} />
                </Td>
                <Td dataLabel={columns[1]}>{secret.type}</Td>
                <Td dataLabel={columns[2]}>{secret.immutable ? 'Yes' : 'No'}</Td>
                <Td dataLabel={columns[3]}>{secret.audit.createdAt}</Td>
                <Td dataLabel={columns[4]}>
                  {secret.mounts?.map((m) => m.name).join(', ') || '-'}
                </Td>
                <Td isActionCell>
                  <ActionsColumn items={getRowActions(secret)} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <SecretsCreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        onSecretCreated={onSecretCreatedOrUpdated}
        existingSecretNames={secrets.map((s) => s.name)}
      />

      {activeSecret && (
        <SecretsCreateModal
          isOpen={isEditModalOpen}
          setIsOpen={setIsEditModalOpen}
          secretToEdit={activeSecret}
          onSecretUpdated={onSecretCreatedOrUpdated}
          existingSecretNames={secrets.map((s) => s.name)}
        />
      )}

      {activeSecret && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          variant={ModalVariant.small}
          className="delete-secret-modal"
        >
          <ModalHeader title="Delete Secret?" titleIconVariant="warning" />
          <ModalBody>
            <div style={{ marginBottom: 'var(--pf-v6-global--spacer--md)' }}>
              Are you sure you want to delete secret <b>{activeSecret.name}</b>? This action cannot
              be undone.
            </div>
            {activeSecret.mounts && activeSecret.mounts.length > 0 && (
              <div
                style={{
                  marginTop: 'var(--pf-v6-global--spacer--md)',
                  background: 'var(--pf-v5-global--danger-color--200)',
                  padding: 'var(--pf-v6-global--spacer--md)',
                  borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
                  borderLeft: '4px solid var(--pf-v5-global--danger-color--100)',
                }}
              >
                <p
                  style={{
                    color: 'var(--pf-v5-global--danger-color--100)',
                    fontWeight: 'bold',
                    marginBottom: 'var(--pf-v5-global--spacer--xs)',
                  }}
                >
                  <ExclamationTriangleIcon /> This secret is in use!
                </p>
                <p style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                  It is currently mounted by the following workspaces:
                </p>
                <ul
                  style={{
                    fontSize: 'var(--pf-v5-global--FontSize--sm)',
                    marginLeft: 'var(--pf-v5-global--spacer--md)',
                    marginTop: 'var(--pf-v5-global--spacer--xs)',
                  }}
                >
                  {activeSecret.mounts.map((m) => (
                    <li key={m.name}>{m.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button key="delete" variant="danger" isLoading={deleteLoading} onClick={confirmDelete}>
              Delete
            </Button>
            <Button key="cancel" variant="link" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </PageSection>
  );
};
