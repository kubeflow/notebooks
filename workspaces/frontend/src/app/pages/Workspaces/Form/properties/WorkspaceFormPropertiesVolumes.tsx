import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Dropdown, DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
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
import { PvcsPVCListItem } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { WorkspacesPodVolumeMountValue } from '~/app/types';
import {
  getMountPathValidationError,
  normalizeMountPath,
} from '~/app/pages/Workspaces/Form/helpers';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';
import { VolumesAttachModal } from './volumes/VolumesAttachModal';

interface WorkspaceFormPropertiesVolumesProps {
  volumes: WorkspacesPodVolumeMountValue[];
  setVolumes: (volumes: WorkspacesPodVolumeMountValue[]) => void;
  fixedMountPath?: string; // For home volume only
}

const NUM_TABLE_COLUMNS = 5; // expand toggle + PVC Name + Mount Path + Read-only Access + Actions

export const WorkspaceFormPropertiesVolumes: React.FC<WorkspaceFormPropertiesVolumesProps> = ({
  volumes,
  setVolumes,
  fixedMountPath,
}) => {
  const isHomeMounted = !!fixedMountPath && volumes.length > 0;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<WorkspacesPodVolumeMountValue>({
    pvcName: '',
    mountPath: fixedMountPath ?? '',
    readOnly: false,
    isAttached: false,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [availablePVCs, setAvailablePVCs] = useState<PvcsPVCListItem[]>([]);
  const [editingMountPath, setEditingMountPath] = useState<number | null>(null);
  const [editMountPathValue, setEditMountPathValue] = useState('');
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());

  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  useEffect(() => {
    const fetchPVCs = async () => {
      try {
        const response = await api.pvc.listPvCs(selectedNamespace);
        setAvailablePVCs(response.data);
      } catch {
        // PVC list unavailable - user can still create volumes manually
      }
    };
    fetchPVCs();
  }, [api.pvc, selectedNamespace]);

  const resetForm = useCallback(() => {
    setFormData({
      pvcName: '',
      mountPath: fixedMountPath ?? '',
      readOnly: false,
      isAttached: false,
    });
    setEditIndex(null);
    setIsModalOpen(false);
  }, [fixedMountPath]);

  const handleAddOrEdit = useCallback(() => {
    if (!formData.pvcName || !formData.mountPath) {
      return;
    }
    if (editIndex !== null) {
      const updated = [...volumes];
      updated[editIndex] = formData;
      setVolumes(updated);
    } else {
      setVolumes([...volumes, formData]);
    }
    resetForm();
  }, [formData, editIndex, volumes, setVolumes, resetForm]);

  const handleEdit = useCallback(
    (index: number) => {
      setFormData(volumes[index]);
      setEditIndex(index);
      setIsModalOpen(true);
    },
    [volumes],
  );

  const openDetachModal = useCallback((index: number) => {
    setDeleteIndex(index);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    setVolumes(volumes.filter((_, i) => i !== deleteIndex));
    setIsDeleteModalOpen(false);
    setDeleteIndex(null);
  }, [deleteIndex, volumes, setVolumes]);

  const mountedPaths = useMemo(() => new Set(volumes.map((v) => v.mountPath)), [volumes]);

  const handleAttachPVC = useCallback(
    (pvc: PvcsPVCListItem, mountPath: string, readOnly: boolean) => {
      setVolumes([...volumes, { pvcName: pvc.name, mountPath, readOnly, isAttached: true }]);
      setIsAttachModalOpen(false);
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
    const validationError = getMountPathValidationError(
      volumes,
      editMountPathValue,
      editingMountPath,
    );
    if (validationError) {
      return;
    }
    const normalized = normalizeMountPath(editMountPathValue);
    const updated = [...volumes];
    updated[editingMountPath] = { ...updated[editingMountPath], mountPath: normalized };
    setVolumes(updated);
    setEditingMountPath(null);
  }, [editingMountPath, editMountPathValue, volumes, setVolumes]);

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
      ? getMountPathValidationError(volumes, editMountPathValue, editingMountPath)
      : null;

  return (
    <>
      {volumes.length > 0 && (
        <Table
          variant={TableVariant.compact}
          aria-label="Volumes Table"
          data-testid="volumes-table"
        >
          <Thead>
            <Tr>
              <Th screenReaderText="Row expansion" />
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
                <Tr>
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
                      isFixed={!!fixedMountPath}
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
                      {volume.isAttached ? (
                        <Tooltip content="Attached volumes cannot be edited.">
                          <DropdownItem isAriaDisabled>Edit</DropdownItem>
                        </Tooltip>
                      ) : (
                        <DropdownItem onClick={() => handleEdit(index)}>Edit</DropdownItem>
                      )}
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
      <Tooltip
        content="Only one home volume can be mounted."
        trigger={isHomeMounted ? 'mouseenter focus' : ''}
      >
        <Button
          variant="secondary"
          onClick={() => setIsAttachModalOpen(true)}
          isDisabled={isHomeMounted}
          className="pf-v6-u-mt-md pf-v6-u-mr-md"
          data-testid="attach-existing-volume-button"
        >
          Attach Existing Volume
        </Button>
      </Tooltip>
      <Tooltip
        content="Only one home volume can be mounted."
        trigger={isHomeMounted ? 'mouseenter focus' : ''}
      >
        <Button
          variant="secondary"
          onClick={() => setIsModalOpen(true)}
          isDisabled={isHomeMounted}
          className="pf-v6-u-mb-md"
          data-testid="create-volume-button"
        >
          Attach New Volume
        </Button>
      </Tooltip>

      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        variant={ModalVariant.small}
        data-testid="volume-modal"
      >
        <ModalHeader
          title={editIndex !== null ? 'Edit Volume' : 'Create Volume'}
          description="Add a volume and optionally connect it with an existing workspace."
        />
        <ModalBody>
          <Form>
            <ThemeAwareFormGroupWrapper label="PVC Name" isRequired fieldId="pvc-name">
              <TextInput
                name="pvcName"
                isRequired
                type="text"
                value={formData.pvcName}
                onChange={(_, val) => setFormData({ ...formData, pvcName: val })}
                id="pvc-name"
                data-testid="pvc-name-input"
              />
            </ThemeAwareFormGroupWrapper>
            <ThemeAwareFormGroupWrapper
              label="Mount Path"
              isRequired
              fieldId="mount-path"
              helperTextNode={
                fixedMountPath && (
                  <HelperText>
                    <HelperTextItem>
                      The mount path is defined by the workspace kind and cannot be changed.
                    </HelperTextItem>
                  </HelperText>
                )
              }
            >
              <TextInput
                name="mountPath"
                isRequired
                type="text"
                value={formData.mountPath}
                isDisabled={!!fixedMountPath}
                onChange={(_, val) => setFormData({ ...formData, mountPath: val })}
                id="mount-path"
                data-testid="mount-path-input"
              />
            </ThemeAwareFormGroupWrapper>
            <FormGroup fieldId="readonly-access" className="pf-v6-u-pt-lg">
              <Switch
                id="readonly-access-switch"
                label="Enable read-only access"
                isChecked={formData.readOnly}
                onChange={() => setFormData({ ...formData, readOnly: !formData.readOnly })}
                data-testid="readonly-access-switch"
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            key="confirm"
            onClick={handleAddOrEdit}
            isDisabled={!formData.pvcName || !formData.mountPath}
            data-testid="volume-modal-submit-button"
          >
            {editIndex !== null ? 'Save' : 'Create'}
          </Button>
          <Button
            key="cancel"
            variant="link"
            onClick={resetForm}
            data-testid="volume-modal-cancel-button"
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        variant={ModalVariant.small}
        data-testid="detach-volume-modal"
      >
        <ModalHeader
          title="Detach Volume?"
          description="The volume and all of its resources will be detached from the workspace."
        />
        <ModalFooter>
          <Button
            key="detach"
            variant="danger"
            onClick={handleDelete}
            data-testid="detach-volume-confirm-button"
          >
            Detach
          </Button>
          <Button
            key="cancel"
            variant="link"
            onClick={() => setIsDeleteModalOpen(false)}
            data-testid="detach-volume-cancel-button"
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <VolumesAttachModal
        isOpen={isAttachModalOpen}
        setIsOpen={setIsAttachModalOpen}
        availablePVCs={availablePVCs}
        mountedPaths={mountedPaths}
        onAttach={handleAttachPVC}
        fixedMountPath={fixedMountPath}
      />
    </>
  );
};

export default WorkspaceFormPropertiesVolumesProps;
