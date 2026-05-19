import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { emptyPodConfig } from '~/app/pages/WorkspaceKinds/Form/helpers';
import {
  TolerationEntry,
  WorkspaceKindPodConfigValue,
  WorkspaceKindPodConfigData,
} from '~/app/types';
import { WorkspaceKindFormPaginatedTable } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindFormPaginatedTable';
import { WorkspaceKindFormPodConfigModal } from './WorkspaceKindFormPodConfigModal';
import { WorkspaceKindFormTolerations } from './WorkspaceKindFormTolerations';

interface WorkspaceKindFormPodConfigProps {
  podConfig: WorkspaceKindPodConfigData;
  updatePodConfig: (podConfigs: WorkspaceKindPodConfigData) => void;
}

export const WorkspaceKindFormPodConfig: React.FC<WorkspaceKindFormPodConfigProps> = ({
  podConfig,
  updatePodConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [defaultId, setDefaultId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [currConfig, setCurrConfig] = useState<WorkspaceKindPodConfigValue>({ ...emptyPodConfig });
  const [tolerationModalOpenFor, setTolerationModalOpenFor] = useState<string | null>(null);

  useEffect(() => {
    setDefaultId(podConfig.default);
  }, [podConfig.default]);

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
      const currentValues = podConfig.values ?? [];
      if (editIndex !== null) {
        const updated = [...currentValues];
        updated[editIndex] = config;
        updatePodConfig({ ...podConfig, values: updated });
      } else {
        updatePodConfig({ ...podConfig, values: [...currentValues, config] });
      }
      clearForm();
    },
    [clearForm, editIndex, podConfig, updatePodConfig],
  );

  const handleEdit = useCallback(
    (index: number) => {
      setCurrConfig((podConfig.values ?? [])[index]);
      setEditIndex(index);
      setIsModalOpen(true);
    },
    [podConfig.values],
  );

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    const currentValues = podConfig.values ?? [];
    const removedId = currentValues[deleteIndex].id;
    tolerationSettersCache.current.delete(removedId);
    modalSettersCache.current.delete(removedId);
    updatePodConfig({
      default: currentValues[deleteIndex].id === defaultId ? '' : defaultId,
      values: currentValues.filter((_, i) => i !== deleteIndex),
    });
    if (currentValues[deleteIndex].id === defaultId) {
      setDefaultId('');
    }
    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, [deleteIndex, podConfig, updatePodConfig, setDefaultId, defaultId]);

  const podConfigRef = useRef(podConfig);
  podConfigRef.current = podConfig;
  const updatePodConfigRef = useRef(updatePodConfig);
  updatePodConfigRef.current = updatePodConfig;

  const tolerationSettersCache = useRef(
    new Map<string, React.Dispatch<React.SetStateAction<TolerationEntry[]>>>(),
  );
  const modalSettersCache = useRef(
    new Map<string, React.Dispatch<React.SetStateAction<boolean>>>(),
  );

  const getTolerationsForConfig = useCallback(
    (configId: string): React.Dispatch<React.SetStateAction<TolerationEntry[]>> => {
      let setter = tolerationSettersCache.current.get(configId);
      if (!setter) {
        setter = (action) => {
          const config = podConfigRef.current;
          const currentIndex = (config.values ?? []).findIndex((v) => v.id === configId);
          if (currentIndex === -1) {
            return;
          }
          const updated = [...(config.values ?? [])];
          const current = updated[currentIndex].tolerations ?? [];
          const next = typeof action === 'function' ? action(current) : action;
          updated[currentIndex] = { ...updated[currentIndex], tolerations: next };
          updatePodConfigRef.current({ ...config, values: updated });
        };
        tolerationSettersCache.current.set(configId, setter);
      }
      return setter;
    },
    [],
  );

  const getIsTolerationModalOpen = useCallback(
    (configId: string) => tolerationModalOpenFor === configId,
    [tolerationModalOpenFor],
  );

  const getSetIsTolerationModalOpen = useCallback(
    (configId: string): React.Dispatch<React.SetStateAction<boolean>> => {
      let setter = modalSettersCache.current.get(configId);
      if (!setter) {
        setter = (action) => {
          setTolerationModalOpenFor((prev) => {
            const isCurrentlyOpen = prev === configId;
            const next = typeof action === 'function' ? action(isCurrentlyOpen) : action;
            return next ? configId : null;
          });
        };
        modalSettersCache.current.set(configId, setter);
      }
      return setter;
    },
    [],
  );

  const tolerationDispatchers = useMemo(
    () =>
      new Map(
        (podConfig.values ?? []).map((config) => [
          config.id,
          {
            setTolerations: getTolerationsForConfig(config.id),
            setIsTolerationModalOpen: getSetIsTolerationModalOpen(config.id),
          },
        ]),
      ),
    [podConfig.values, getTolerationsForConfig, getSetIsTolerationModalOpen],
  );

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
      <ExpandableSection
        toggleText="Pod Configurations"
        onToggle={() => setIsExpanded((prev) => !prev)}
        isExpanded={isExpanded}
        isIndented
      >
        {(podConfig.values ?? []).length === 0 && (
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
        {(podConfig.values ?? []).length > 0 && (
          <>
            <Content component="p">
              Pod configurations define the hardware resource options available to a Workspace.
              Expand each configuration to access nodeSelector and tolerations, allowing you to
              constrain pods to specific node groups.
            </Content>
            <WorkspaceKindFormPaginatedTable
              ariaLabel="Pod Configs Table"
              dataTestId="pod-configs-table"
              rows={podConfig.values ?? []}
              defaultId={defaultId}
              setDefaultId={(id) => {
                updatePodConfig({ ...podConfig, default: id });
                setDefaultId(id);
              }}
              handleEdit={handleEdit}
              openDeleteModal={openDeleteModal}
              expandedContent={(row, globalIndex) => (
                <>
                  <Title headingLevel="h4" className="pf-v6-u-mb-sm">
                    Tolerations
                  </Title>
                  <p className="pf-v6-u-mb-md pf-v6-u-color-200">
                    Tolerations are applied to pods and allow the scheduler to schedule pods on
                    nodes with matching taints
                  </p>
                  <Button
                    variant="secondary"
                    className="pf-v6-u-mb-md"
                    onClick={() => setTolerationModalOpenFor(row.id)}
                    data-testid={`add-toleration-button-${globalIndex}`}
                  >
                    Add Toleration
                  </Button>
                  <WorkspaceKindFormTolerations
                    tolerations={(podConfig.values ?? [])[globalIndex]?.tolerations ?? []}
                    setTolerations={tolerationDispatchers.get(row.id)!.setTolerations}
                    isTolerationModalOpen={getIsTolerationModalOpen(row.id)}
                    setIsTolerationModalOpen={
                      tolerationDispatchers.get(row.id)!.setIsTolerationModalOpen
                    }
                  />
                </>
              )}
            />
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
          data-testid="remove-pod-config-modal"
        >
          <ModalHeader
            title="Remove Pod Config?"
            description="The pod config will be removed from the workspace kind."
          />
          <ModalFooter>
            <Button
              key="remove"
              variant="danger"
              onClick={handleDelete}
              data-testid="remove-pod-config-confirm-button"
            >
              Remove
            </Button>
            <Button
              key="cancel"
              variant="link"
              onClick={() => setIsDeleteModalOpen(false)}
              data-testid="remove-pod-config-cancel-button"
            >
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </ExpandableSection>
    </Content>
  );
};
