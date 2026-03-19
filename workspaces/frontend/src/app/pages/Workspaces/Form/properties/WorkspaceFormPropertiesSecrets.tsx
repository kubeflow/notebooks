import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableVariant,
  ExpandableRowContent,
} from '@patternfly/react-table/dist/esm/components/Table';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Dropdown, DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import {
  DEFAULT_MODE,
  DetachWarningAlert,
  getMountPathValidationError,
  normalizeMountPath,
} from '~/app/pages/Workspaces/Form/helpers';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspacesPodSecretMountValue } from '~/app/types';
import { ConfirmModal } from '~/shared/components/ConfirmModal';
import { useSecretKeys } from '~/app/hooks/useSecretKeys';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';
import { SecretsCreateModal } from './secrets/SecretsCreateModal';
import { SecretsAttachModal } from './secrets/SecretsAttachModal';

interface WorkspaceFormPropertiesSecretsProps {
  secrets: WorkspacesPodSecretMountValue[];
  setSecrets: (secrets: WorkspacesPodSecretMountValue[]) => void;
}

const NUM_TABLE_COLUMNS = 5; // expand toggle + Secret Name + Mount Path + Default Mode + Actions

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
  const [secretToEdit, setSecretToEdit] = useState<SecretsSecretListItem | undefined>(undefined);
  const [expandedSecrets, setExpandedSecrets] = useState<Set<string>>(new Set());
  const [editingMountPath, setEditingMountPath] = useState<number | null>(null);
  const [editMountPathValue, setEditMountPathValue] = useState('');

  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();
  const { getSecretKeysState, fetchSecretKeys } = useSecretKeys();

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

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleToggleExpand = useCallback(
    (secretName: string) => {
      setExpandedSecrets((prev) => {
        const next = new Set(prev);
        if (next.has(secretName)) {
          next.delete(secretName);
        } else {
          next.add(secretName);
          fetchSecretKeys(secretName);
        }
        return next;
      });
    },
    [fetchSecretKeys],
  );

  const handleAttachSecrets = useCallback(
    (newSecrets: SecretsSecretListItem[], mountPath: string, mode: number) => {
      const newSecretMounts: WorkspacesPodSecretMountValue[] = newSecrets.map((secret) => ({
        secretName: secret.name,
        mountPath,
        defaultMode: mode,
        isAttached: true,
      }));

      setSecrets([...secrets, ...newSecretMounts]);
      setIsAttachModalOpen(false);
    },
    [secrets, setSecrets],
  );

  const onDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (deleteIndex === null) {
      return;
    }
    const secretToDelete = secrets[deleteIndex];
    if (!secretToDelete.isAttached) {
      await api.secrets.deleteSecret(selectedNamespace, secretToDelete.secretName);
    }
    setSecrets(secrets.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
  }, [deleteIndex, secrets, api.secrets, selectedNamespace, setSecrets]);

  const handleSecretCreated = useCallback(
    async (secretName: string) => {
      const existingSecret = secrets.find((s) => s.secretName === secretName);
      if (existingSecret) {
        return;
      }

      // Add the newly created secret to the table with default mount path and mode
      const newSecret: WorkspacesPodSecretMountValue = {
        secretName,
        mountPath: `/secrets/${secretName}`,
        defaultMode: DEFAULT_MODE,
        isAttached: false,
      };

      setSecrets([...secrets, newSecret]);

      const secretsResponse = await api.secrets.listSecrets(selectedNamespace);
      setAvailableSecrets(secretsResponse.data);
    },
    [secrets, setSecrets, api.secrets, selectedNamespace],
  );

  const openEditModal = useCallback(
    (secretName: string) => {
      const secret = availableSecrets.find((s) => s.name === secretName);

      if (secret && !secret.canUpdate) {
        return;
      }

      const secretData = secret ?? {
        name: secretName,
        type: 'Opaque',
        immutable: false,
        canMount: true,
        canUpdate: true,
        audit: { createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: '' },
      };

      setIsEditModalOpen(true);
      setSecretToEdit(secretData);
    },
    [availableSecrets],
  );

  const handleSecretUpdated = useCallback(async () => {
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

  const mountedKeys = useMemo(
    () => new Set(secrets.map((s) => `${s.secretName}:${s.mountPath}`)),
    [secrets],
  );

  const otherMountPaths = useMemo(
    () =>
      new Set(
        secrets
          .filter((_, i) => i !== editingMountPath)
          .map((s) => normalizeMountPath(s.mountPath)),
      ),
    [secrets, editingMountPath],
  );

  const handleStartMountPathEdit = useCallback(
    (index: number) => {
      setEditingMountPath(index);
      setEditMountPathValue(secrets[index].mountPath);
    },
    [secrets],
  );

  const handleConfirmMountPathEdit = useCallback(() => {
    if (editingMountPath === null) {
      return;
    }
    const validationError = getMountPathValidationError(otherMountPaths, editMountPathValue);
    if (validationError) {
      return;
    }
    const normalized = normalizeMountPath(editMountPathValue);
    const updated = [...secrets];
    updated[editingMountPath] = { ...updated[editingMountPath], mountPath: normalized };
    setSecrets(updated);
    setEditingMountPath(null);
  }, [editingMountPath, editMountPathValue, otherMountPaths, secrets, setSecrets]);

  const handleCancelMountPathEdit = useCallback(() => {
    setEditingMountPath(null);
  }, []);

  const mountPathValidationError =
    editingMountPath !== null
      ? getMountPathValidationError(otherMountPaths, editMountPathValue)
      : null;

  const attachButton = (
    <Button
      variant="secondary"
      onClick={() => setIsAttachModalOpen(true)}
      data-testid="attach-existing-secrets-button"
    >
      Attach Existing Secrets
    </Button>
  );

  const createButton = (
    <Button
      variant="secondary"
      onClick={() => setIsCreateModalOpen(true)}
      data-testid="attach-new-secret-button"
    >
      Attach New Secret
    </Button>
  );

  const renderExpandedContent = (secretName: string) => {
    const state = getSecretKeysState(secretName);

    if (!state.isLoaded) {
      return <Spinner size="md" aria-label="Loading secret keys" />;
    }

    if (state.error) {
      return <span>{state.error}</span>;
    }

    if (state.keys.length === 0) {
      return <span>No keys found in this secret.</span>;
    }

    return (
      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
        {state.keys.map((key) => (
          <Flex
            key={key}
            spaceItems={{ default: 'spaceItemsMd' }}
            alignItems={{ default: 'alignItemsBaseline' }}
          >
            <FlexItem>
              <strong>{key}</strong>
            </FlexItem>
            <FlexItem>*********</FlexItem>
          </Flex>
        ))}
      </Flex>
    );
  };

  return (
    <>
      {secrets.length === 0 ? (
        <EmptyState
          titleText="No secrets yet"
          headingLevel="h4"
          icon={PlusCircleIcon}
          data-testid="secrets-empty-state"
        >
          <EmptyStateBody>To get started, attach a secret.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              {attachButton}
              {createButton}
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <>
          <Table
            className="secrets-table mui-table-cells-middle"
            variant={TableVariant.compact}
            aria-label="Secrets Table"
            data-testid="secrets-table"
          >
            <Thead>
              <Tr>
                <Th screenReaderText="Row expansion" />
                <Th width={30}>Secret Name</Th>
                <Th width={30}>Mount Path</Th>
                <Th>Default Mode</Th>
                <Th aria-label="Actions" />
              </Tr>
            </Thead>
            {secrets.map((secret, index) => {
              const secretDetails = availableSecrets.find((s) => s.name === secret.secretName);
              const isImmutable = secretDetails?.immutable ?? false;
              const canUpdate = secretDetails?.canUpdate ?? true;
              const isExpanded = expandedSecrets.has(secret.secretName);

              return (
                <Tbody key={`${secret.secretName}:${secret.mountPath}`} isExpanded={isExpanded}>
                  <Tr>
                    <Td
                      expand={{
                        rowIndex: index,
                        isExpanded,
                        onToggle: () => handleToggleExpand(secret.secretName),
                      }}
                      data-testid={`expand-secret-${secret.secretName}`}
                    />
                    <Td dataLabel="Secret Name">
                      <Flex
                        spaceItems={{ default: 'spaceItemsSm' }}
                        alignItems={{ default: 'alignItemsCenter' }}
                      >
                        <FlexItem>{secret.secretName}</FlexItem>
                        {isImmutable && (
                          <FlexItem>
                            <Label color="orange" isCompact>
                              Immutable
                            </Label>
                          </FlexItem>
                        )}
                      </Flex>
                    </Td>
                    <Td dataLabel="Mount Path" hasAction>
                      <MountPathField
                        variant="cell"
                        value={editingMountPath === index ? editMountPathValue : secret.mountPath}
                        index={index}
                        editingIndex={editingMountPath}
                        itemId={secret.secretName}
                        onChange={setEditMountPathValue}
                        onStartEdit={handleStartMountPathEdit}
                        onConfirm={handleConfirmMountPathEdit}
                        onCancel={handleCancelMountPathEdit}
                        error={mountPathValidationError}
                      />
                    </Td>
                    <Td dataLabel="Default Mode">{secret.defaultMode?.toString(8) ?? '644'}</Td>
                    <Td isActionCell hasAction>
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
                        {isImmutable || !canUpdate ? (
                          <Tooltip
                            content={
                              isImmutable
                                ? 'This secret is immutable and cannot be edited.'
                                : 'You do not have permission to edit this secret.'
                            }
                          >
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
                          Detach
                        </DropdownItem>
                      </Dropdown>
                    </Td>
                  </Tr>
                  <Tr isExpanded={isExpanded}>
                    <Td />
                    <Td colSpan={NUM_TABLE_COLUMNS - 1}>
                      <ExpandableRowContent>
                        {renderExpandedContent(secret.secretName)}
                      </ExpandableRowContent>
                    </Td>
                  </Tr>
                </Tbody>
              );
            })}
          </Table>
          <Flex className="pf-v6-u-mt-md" spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>{attachButton}</FlexItem>
            <FlexItem>{createButton}</FlexItem>
          </Flex>
        </>
      )}

      <SecretsAttachModal
        availableSecrets={availableSecrets}
        isOpen={isAttachModalOpen}
        setIsOpen={setIsAttachModalOpen}
        onAttach={handleAttachSecrets}
        mountedKeys={mountedKeys}
        existingMountPaths={new Set(secrets.map((s) => s.mountPath))}
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

      {deleteIndex !== null && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          title="Detach Secret?"
          onConfirm={handleDelete}
          onClose={onDeleteModalClose}
          confirmLabel="Detach"
          confirmLabelOnLoading="Detaching..."
          errorTitle="Failed to detach secret"
          testId="detach-secret-modal"
        >
          <DetachWarningAlert
            resourceName={secrets[deleteIndex].secretName}
            testId="detach-secret-danger-alert"
            isAttached={!!secrets[deleteIndex].isAttached}
          />
        </ConfirmModal>
      )}
    </>
  );
};

export default WorkspaceFormPropertiesSecrets;
