import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Dropdown, DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import {
  ExpandableRowContent,
  Table,
  TableVariant,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@patternfly/react-table/dist/esm/components/Table';
import { CubeIcon } from '@patternfly/react-icons/dist/esm/icons/cube-icon';
import { PvcsPVCListItem, StorageclassesStorageClassListItem } from '~/generated/data-contracts';
import DeleteModal from '~/shared/components/DeleteModal';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { WorkspacesPodVolumeMountValue } from '~/app/types';
import {
  getMountPathValidationError,
  normalizeMountPath,
} from '~/app/pages/Workspaces/Form/helpers';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';
import { VolumesAttachModal } from './volumes/VolumesAttachModal';
import { VolumesCreateModal } from './volumes/VolumesCreateModal';

interface WorkspaceFormPropertiesVolumesProps {
  volumes: WorkspacesPodVolumeMountValue[];
  setVolumes: (volumes: WorkspacesPodVolumeMountValue[]) => void;
  fixedMountPath?: string; // For home volume only
  excludedPvcNames?: Set<string>; // PVC names used in the other section
}

const NUM_TABLE_COLUMNS = 5; // expand toggle + PVC Name + Mount Path + Read-only Access + Actions

export const WorkspaceFormPropertiesVolumes: React.FC<WorkspaceFormPropertiesVolumesProps> = ({
  volumes,
  setVolumes,
  fixedMountPath,
  excludedPvcNames,
}) => {
  const isHomeMounted = !!fixedMountPath && volumes.length > 0;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [availablePVCs, setAvailablePVCs] = useState<PvcsPVCListItem[]>([]);
  const [storageClasses, setStorageClasses] = useState<StorageclassesStorageClassListItem[]>([]);
  const [editingMountPath, setEditingMountPath] = useState<number | null>(null);
  const [editMountPathValue, setEditMountPathValue] = useState('');
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [pvcLoadError, setPvcLoadError] = useState<string | null>(null);

  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  useEffect(() => {
    const fetchPVCs = async () => {
      try {
        const response = await api.pvc.listPvCs(selectedNamespace);
        setAvailablePVCs(response.data);
      } catch {
        setPvcLoadError('Failed to load volume details. Connection info may be unavailable.');
      }
    };
    const fetchStorageClasses = async () => {
      try {
        const response = await api.storageClasses.listStorageClasses();
        setStorageClasses(response.data);
      } catch {
        // Storage classes unavailable - group labels will fall back to raw names
      }
    };
    fetchPVCs();
    fetchStorageClasses();
  }, [api.pvc, api.storageClasses, selectedNamespace]);

  const openDetachModal = useCallback((index: number) => {
    setDeleteIndex(index);
    setIsDeleteModalOpen(true);
  }, []);

  const onDeleteModalClose = useCallback(() => {
    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (deleteIndex === null) {
      return;
    }
    if (!volumes[deleteIndex].isAttached) {
      await api.pvc.deletePvc(selectedNamespace, volumes[deleteIndex].pvcName);
    }
    setVolumes(volumes.filter((_, i) => i !== deleteIndex));
    onDeleteModalClose();
  }, [deleteIndex, volumes, setVolumes, onDeleteModalClose, api.pvc, selectedNamespace]);

  const mountedPaths = useMemo(() => new Set(volumes.map((v) => v.mountPath)), [volumes]);

  const allExcludedPvcNames = useMemo(() => {
    const set = new Set(excludedPvcNames);
    for (const v of volumes) {
      set.add(v.pvcName);
    }
    return set;
  }, [excludedPvcNames, volumes]);

  const handleAttachPVC = useCallback(
    (pvc: PvcsPVCListItem, mountPath: string, readOnly: boolean) => {
      setVolumes([...volumes, { pvcName: pvc.name, mountPath, readOnly, isAttached: true }]);
      setIsAttachModalOpen(false);
    },
    [volumes, setVolumes],
  );

  const handleVolumeCreated = useCallback(
    (volume: WorkspacesPodVolumeMountValue) => {
      setVolumes([...volumes, volume]);
    },
    [volumes, setVolumes],
  );

  const handleStartMountPathEdit = useCallback(
    (index: number) => {
      setEditingMountPath(index);
      setEditMountPathValue(volumes[index].mountPath);
    },
    [volumes],
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
    const updated = [...volumes];
    updated[editingMountPath] = { ...updated[editingMountPath], mountPath: normalized };
    setVolumes(updated);
    setEditingMountPath(null);
  }, [editingMountPath, editMountPathValue, otherMountPaths, volumes, setVolumes]);

  const handleCancelMountPathEdit = useCallback(() => {
    setEditingMountPath(null);
  }, []);

  const handleToggleExpand = useCallback((pvcName: string) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(pvcName)) {
        next.delete(pvcName);
      } else {
        next.add(pvcName);
      }
      return next;
    });
  }, []);

  const renderExpandedContent = useCallback(
    (pvcName: string) => {
      const pvc = availablePVCs.find((p) => p.name === pvcName);
      if (!pvc || (pvc.workspaces.length === 0 && pvc.pods.length === 0)) {
        return <span>No connected workspaces or pods.</span>;
      }

      return (
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>This volume is currently connected to the following resources:</FlexItem>
          {pvc.workspaces.length > 0 && (
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem style={{ minWidth: '6rem' }}>Workspaces:</FlexItem>
              <FlexItem style={{ flex: 1 }}>
                <LabelGroup numLabels={10}>
                  {pvc.workspaces.map((ws) => (
                    <Tooltip
                      key={ws.name}
                      content={
                        <>
                          {ws.podTemplatePod && <div>Pod: {ws.podTemplatePod.name}</div>}
                          <div>State: {ws.state}</div>
                          {ws.stateMessage && <div>{ws.stateMessage}</div>}
                        </>
                      }
                    >
                      <Label
                        isCompact
                        variant="outline"
                        color="teal"
                        icon={<CubeIcon color="teal" />}
                      >
                        {ws.name}
                      </Label>
                    </Tooltip>
                  ))}
                </LabelGroup>
              </FlexItem>
            </Flex>
          )}
          {pvc.pods.length > 0 && (
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem style={{ minWidth: '6rem' }}>Pods:</FlexItem>
              <FlexItem style={{ flex: 1 }}>
                <LabelGroup numLabels={10}>
                  {pvc.pods.map((pod) => (
                    <Tooltip
                      key={pod.name}
                      content={
                        <>
                          <div>Name: {pod.name}</div>
                          {pod.node && <div>Node: {pod.node.name}</div>}
                          <div>Phase: {pod.phase}</div>
                        </>
                      }
                    >
                      <Label isCompact variant="outline">
                        {pod.name}
                      </Label>
                    </Tooltip>
                  ))}
                </LabelGroup>
              </FlexItem>
            </Flex>
          )}
        </Flex>
      );
    },
    [availablePVCs],
  );

  const mountPathValidationError =
    editingMountPath !== null
      ? getMountPathValidationError(otherMountPaths, editMountPathValue)
      : null;

  const attachButton = (
    <Tooltip
      content="Only one home volume can be mounted."
      trigger={isHomeMounted ? 'mouseenter focus' : ''}
    >
      <Button
        variant="secondary"
        onClick={() => setIsAttachModalOpen(true)}
        isDisabled={isHomeMounted}
        data-testid="attach-existing-volume-button"
      >
        Attach Existing Volume
      </Button>
    </Tooltip>
  );

  const createButton = (
    <Tooltip
      content="Only one home volume can be mounted."
      trigger={isHomeMounted ? 'mouseenter focus' : ''}
    >
      <Button
        variant="secondary"
        onClick={() => setIsCreateModalOpen(true)}
        isDisabled={isHomeMounted}
        data-testid="create-volume-button"
      >
        Attach New Volume
      </Button>
    </Tooltip>
  );

  return (
    <>
      {pvcLoadError && (
        <Alert
          variant={AlertVariant.warning}
          isInline
          title={pvcLoadError}
          className="pf-v6-u-mb-sm"
        />
      )}
      {volumes.length === 0 ? (
        <EmptyState
          titleText="No volumes attached"
          headingLevel="h4"
          icon={PlusCircleIcon}
          data-testid="volumes-empty-state"
        >
          <EmptyStateBody>To get started, attach a volume.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              {attachButton}
              {createButton}
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <Table
          variant={TableVariant.compact}
          aria-label="Volumes Table"
          data-testid="volumes-table"
        >
          <Thead>
            <Tr>
              <Th>PVC Name</Th>
              <Th>Mount Path</Th>
              <Th>Read-only Access</Th>
              <Th aria-label="Actions" />
            </Tr>
          </Thead>
          {volumes.map((volume, index) => {
            const isExpanded = expandedVolumes.has(volume.pvcName);
            return (
              <Tbody key={`${volume.pvcName}:${volume.mountPath}`} isExpanded={isExpanded}>
                <Tr key={index}>
                  <Td
                    expand={{
                      rowIndex: index,
                      isExpanded,
                      onToggle: () => handleToggleExpand(volume.pvcName),
                    }}
                    data-testid={`expand-volume-${volume.pvcName}`}
                  />
                  <Td dataLabel="PVC Name">{volume.pvcName}</Td>
                  <Td dataLabel="Mount Path" hasAction>
                    <MountPathField
                      variant="cell"
                      value={editingMountPath === index ? editMountPathValue : volume.mountPath}
                      index={index}
                      editingIndex={editingMountPath}
                      itemId={volume.pvcName}
                      onChange={setEditMountPathValue}
                      onStartEdit={handleStartMountPathEdit}
                      onConfirm={handleConfirmMountPathEdit}
                      onCancel={handleCancelMountPathEdit}
                      error={mountPathValidationError}
                      isFixed={volume.mountPath === fixedMountPath}
                    />
                  </Td>
                  <Td dataLabel="Read-only Access">{volume.readOnly ? 'Enabled' : 'Disabled'}</Td>
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
                      <DropdownItem onClick={() => openDetachModal(index)}>Detach</DropdownItem>
                    </Dropdown>
                  </Td>
                </Tr>
                <Tr isExpanded={isExpanded}>
                  <Td />
                  <Td colSpan={NUM_TABLE_COLUMNS - 1}>
                    <ExpandableRowContent>
                      {renderExpandedContent(volume.pvcName)}
                    </ExpandableRowContent>
                  </Td>
                </Tr>
              </Tbody>
            );
          })}
        </Table>
      )}
      <Flex className="pf-v6-u-mt-md" spaceItems={{ default: 'spaceItemsMd' }}>
        <FlexItem>{attachButton}</FlexItem>
        <FlexItem>{createButton}</FlexItem>
      </Flex>
      {deleteIndex !== null && (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          title="Detach Volume?"
          onClose={onDeleteModalClose}
          onDelete={handleDelete}
          resourceName={volumes[deleteIndex].pvcName}
          namespace={selectedNamespace}
        />
      )}

      <VolumesAttachModal
        isOpen={isAttachModalOpen}
        setIsOpen={setIsAttachModalOpen}
        availablePVCs={availablePVCs}
        mountedPaths={mountedPaths}
        onAttach={handleAttachPVC}
        fixedMountPath={fixedMountPath}
        excludedPvcNames={allExcludedPvcNames}
        storageClasses={storageClasses}
      />

      <VolumesCreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        onVolumeCreated={handleVolumeCreated}
        excludedPvcNames={excludedPvcNames}
      />
    </>
  );
};

export default WorkspaceFormPropertiesVolumes;
