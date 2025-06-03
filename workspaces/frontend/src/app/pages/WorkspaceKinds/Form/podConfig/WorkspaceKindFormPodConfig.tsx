import React, { useCallback, useState } from 'react';
import {
  Button,
  Content,
  Dropdown,
  MenuToggle,
  DropdownItem,
  Modal,
  ModalHeader,
  ModalFooter,
  ModalVariant,
  EmptyState,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, EllipsisVIcon, CubesIcon } from '@patternfly/react-icons';
import { emptyPodConfig } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindPodConfig, WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

import { WorkspaceKindFormPodConfigModal } from './WorkspaceKindFormPodConfigModal';

interface WorkspaceKindFormPodConfigProps {
  podConfig: WorkspaceKindPodConfig;
  updatePodConfig: (podConfigs: WorkspaceKindPodConfig) => void;
}

export const WorkspaceKindFormPodConfig: React.FC<WorkspaceKindFormPodConfigProps> = ({
  podConfig,
  updatePodConfig,
}) => {
  const [defaultId, setDefaultId] = useState(podConfig.default || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [currConfig, setCurrConfig] = useState<WorkspacePodConfigValue>({ ...emptyPodConfig });

  const clearForm = useCallback(() => {
    setCurrConfig({ ...emptyPodConfig });
    setEditIndex(null);
    setIsModalOpen(false);
  }, []);

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleAddOrEditSubmit = useCallback(() => {
    if (editIndex !== null) {
      const updated = [...podConfig.values];
      updated[editIndex] = currConfig;
      updatePodConfig({ ...podConfig, values: updated });
    } else {
      updatePodConfig({ ...podConfig, values: [...podConfig.values, currConfig] });
    }
    clearForm();
  }, [clearForm, editIndex, podConfig, currConfig, updatePodConfig]);

  const handleEdit = useCallback(
    (index: number) => {
      setCurrConfig(podConfig.values[index]);
      setEditIndex(index);
      setIsModalOpen(true);
    },
    [podConfig.values],
  );

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    updatePodConfig({
      default: podConfig.values[deleteIndex].id === defaultId ? '' : defaultId,
      values: podConfig.values.filter((_, i) => i !== deleteIndex),
    });
    if (podConfig.values[deleteIndex].id === defaultId) {
      setDefaultId('');
    }
    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, [deleteIndex, podConfig, updatePodConfig, setDefaultId, defaultId]);

  const addConfigBtn = (
    <Button
      variant="link"
      icon={<PlusCircleIcon />}
      onClick={() => {
        setIsModalOpen(true);
      }}
    >
      Add Config
    </Button>
  );

  return (
    <Content style={{ height: '100%' }}>
      {podConfig.values.length === 0 && (
        <EmptyState
          titleText="Add A Pod Config To Workspace Kind"
          headingLevel="h4"
          icon={CubesIcon}
        >
          <EmptyStateFooter>
            <EmptyStateActions>{addConfigBtn}</EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      )}
      {podConfig.values.length > 0 && (
        <Table aria-label="pod configs table">
          <Thead>
            <Tr>
              <Th screenReaderText="Row select">Default</Th>
              <Th>ID</Th>
              <Th>Display Name</Th>
              <Th>Hidden</Th>
              <Th>Description</Th>
              <Th aria-label="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {podConfig.values.map((config, index) => (
              <Tr key={config.id}>
                <Td>
                  <input
                    type="radio"
                    name="default-podConfig"
                    checked={defaultId === config.id}
                    onChange={() => {
                      setDefaultId(config.id);
                      updatePodConfig({ ...podConfig, default: config.id });
                    }}
                    aria-label={`Select ${config.id} as default`}
                  />
                </Td>
                <Td>{config.id}</Td>
                <Td>{config.displayName}</Td>
                <Td>{config.hidden ? 'Yes' : 'No'}</Td>
                <Td>{config.description}</Td>
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
          {addConfigBtn}
        </Table>
      )}
      <WorkspaceKindFormPodConfigModal
        isOpen={isModalOpen}
        onClose={clearForm}
        onSubmit={handleAddOrEditSubmit}
        editIndex={editIndex}
        currConfig={currConfig}
        setCurrConfig={setCurrConfig}
      />
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        variant={ModalVariant.small}
      >
        <ModalHeader
          title="Remove Pod Config?"
          description="The pod config will be removed from the workspace kind."
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
    </Content>
  );
};
