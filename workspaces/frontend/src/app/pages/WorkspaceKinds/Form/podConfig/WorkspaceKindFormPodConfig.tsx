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
  ExpandableSection,
  EmptyStateBody,
  Label,
  getUniqueId,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, EllipsisVIcon, CubesIcon } from '@patternfly/react-icons';
import { emptyPodConfig } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindPodConfigValue, WorkspaceKindPodConfigData } from '~/app/types';

import { WorkspaceKindFormPodConfigModal } from './WorkspaceKindFormPodConfigModal';

interface WorkspaceKindFormPodConfigProps {
  podConfig: WorkspaceKindPodConfigData;
  updatePodConfig: (podConfigs: WorkspaceKindPodConfigData) => void;
}

export const WorkspaceKindFormPodConfig: React.FC<WorkspaceKindFormPodConfigProps> = ({
  podConfig,
  updatePodConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [defaultId, setDefaultId] = useState(podConfig.default || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [currConfig, setCurrConfig] = useState<WorkspaceKindPodConfigValue>({ ...emptyPodConfig });

  const clearForm = useCallback(() => {
    setCurrConfig({ ...emptyPodConfig });
    setEditIndex(null);
    setIsModalOpen(false);
  }, []);

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleAddOrEditSubmit = useCallback(
    (config: WorkspaceKindPodConfigValue) => {
      if (editIndex !== null) {
        const updated = [...podConfig.values];
        updated[editIndex] = config;
        updatePodConfig({ ...podConfig, values: updated });
      } else {
        updatePodConfig({ ...podConfig, values: [...podConfig.values, config] });
      }
      clearForm();
    },
    [clearForm, editIndex, podConfig, updatePodConfig],
  );

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
    <Content>
      <div className="pf-u-mb-0">
        <ExpandableSection
          toggleText="Pod Configurations"
          onToggle={() => setIsExpanded((prev) => !prev)}
          isExpanded={isExpanded}
          isIndented
        >
          {podConfig.values.length === 0 && (
            <EmptyState
              titleText="Start by creating a pod configuration"
              headingLevel="h4"
              icon={CubesIcon}
            >
              <EmptyStateBody>
                Configure specifications for pods and containers in your Workspace Kind
              </EmptyStateBody>
              <EmptyStateFooter>
                <EmptyStateActions>{addConfigBtn}</EmptyStateActions>
              </EmptyStateFooter>
            </EmptyState>
          )}
          {podConfig.values.length > 0 && (
            <>
              <Table aria-label="pod configs table">
                <Thead>
                  <Tr>
                    <Th>Display Name</Th>
                    <Th>ID</Th>
                    <Th screenReaderText="Row select">Default</Th>
                    <Th>Hidden</Th>
                    <Th>Labels</Th>
                    <Th aria-label="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {podConfig.values.map((config, index) => (
                    <Tr key={config.id}>
                      <Td>{config.displayName}</Td>
                      <Td>{config.id}</Td>
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
                      <Td>{config.hidden ? 'Yes' : 'No'}</Td>
                      <Td>
                        {config.labels.length > 0 &&
                          config.labels.map((label) => (
                            <Label
                              style={{ marginRight: '4px', marginTop: '4px' }}
                              key={getUniqueId()}
                            >{`${label.key}: ${label.value}`}</Label>
                          ))}
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
                          <DropdownItem onClick={() => openDeleteModal(index)}>Remove</DropdownItem>
                        </Dropdown>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {addConfigBtn}
            </>
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
        </ExpandableSection>
      </div>
    </Content>
  );
};
