import React, { useCallback, useEffect, useState } from 'react';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  Form,
} from '@patternfly/react-core/dist/esm/components/Form';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { WorkspaceKindImagePort } from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

// ---------------------------------------------------------------------------
// Port modal
// ---------------------------------------------------------------------------

interface PortModalProps {
  isOpen: boolean;
  existingPort: WorkspaceKindImagePort | null;
  existingIds: string[];
  existingPorts: number[];
  onClose: () => void;
  onSubmit: (port: WorkspaceKindImagePort) => void;
}

const emptyPort = (): WorkspaceKindImagePort => ({
  id: '',
  displayName: '',
  port: 8888,
  protocol: 'HTTP',
});

const PortModal: React.FC<PortModalProps> = ({
  isOpen,
  existingPort,
  existingIds,
  existingPorts,
  onClose,
  onSubmit,
}) => {
  const [id, setId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [port, setPort] = useState(8888);

  useEffect(() => {
    if (isOpen) {
      if (existingPort) {
        setId(existingPort.id);
        setDisplayName(existingPort.displayName);
        setPort(existingPort.port);
      } else {
        const defaults = emptyPort();
        setId(defaults.id);
        setDisplayName(defaults.displayName);
        setPort(defaults.port);
      }
    }
  }, [isOpen, existingPort]);

  const isDuplicateId = id !== '' && existingIds.includes(id);
  const isDuplicatePort = existingPorts.includes(port);
  const isDisplayNameValid = displayName === '' || displayName.length >= 2;
  const isPortValid = Number.isInteger(port) && port >= 1 && port <= 65535;
  const canSubmit = id !== '' && !isDuplicateId && isPortValid && !isDuplicatePort && isDisplayNameValid;

  const handleSubmit = useCallback(() => {
    onSubmit({ id, displayName, port, protocol: 'HTTP' });
  }, [id, displayName, port, onSubmit]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="small"
      data-testid="port-modal"
      aria-labelledby="port-modal-title"
    >
      <ModalHeader title={existingPort ? 'Edit Port' : 'Add Port'} labelId="port-modal-title" />
      <ModalBody>
        <Form>
          <ThemeAwareFormGroupWrapper
            label="ID"
            isRequired
            fieldId="port-modal-id"
            helperTextNode={isDuplicateId ? <span>ID must be unique</span> : undefined}
          >
            <TextInput
              isRequired
              type="text"
              id="port-modal-id"
              data-testid="port-modal-id-input"
              value={id}
              isDisabled={!!existingPort}
              onChange={(_, val) => setId(val)}
              validated={isDuplicateId ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            fieldId="port-modal-display-name"
            helperTextNode={
              !isDisplayNameValid ? <span>Display name must be at least 2 characters</span> : undefined
            }
          >
            <TextInput
              type="text"
              id="port-modal-display-name"
              data-testid="port-modal-display-name-input"
              value={displayName}
              onChange={(_, val) => setDisplayName(val)}
              validated={!isDisplayNameValid ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Port"
            isRequired
            fieldId="port-modal-port"
            helperTextNode={
              !isPortValid ? (
                <span>Port must be between 1 and 65535</span>
              ) : isDuplicatePort ? (
                <span>Port number is already in use</span>
              ) : undefined
            }
          >
            <TextInput
              isRequired
              type="number"
              id="port-modal-port"
              data-testid="port-modal-port-input"
              value={port}
              onChange={(_, val) => setPort(Number(val))}
              validated={!isPortValid || isDuplicatePort ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper label="Protocol" fieldId="port-modal-protocol">
            <TextInput
              isDisabled
              type="text"
              id="port-modal-protocol"
              data-testid="port-modal-protocol-input"
              value="HTTP"
            />
          </ThemeAwareFormGroupWrapper>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={!canSubmit}
          onClick={handleSubmit}
          data-testid="port-modal-submit-button"
        >
          {existingPort ? 'Save' : 'Add'}
        </Button>
        <Button variant="link" onClick={onClose} data-testid="port-modal-cancel-button">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface WorkspaceKindFormImagePortProps {
  ports: WorkspaceKindImagePort[];
  setPorts: (ports: WorkspaceKindImagePort[]) => void;
}

export const WorkspaceKindFormImagePort: React.FC<WorkspaceKindFormImagePortProps> = ({
  ports,
  setPorts,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleEdit = useCallback((index: number) => {
    setEditIndex(index);
    setIsModalOpen(true);
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      setPorts(ports.filter((_, i) => i !== index));
    },
    [ports, setPorts],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditIndex(null);
  }, []);

  const handleModalSubmit = useCallback(
    (port: WorkspaceKindImagePort) => {
      if (editIndex !== null) {
        setPorts(ports.map((p, i) => (i === editIndex ? port : p)));
      } else {
        setPorts([...ports, port]);
      }
      setIsModalOpen(false);
      setEditIndex(null);
    },
    [editIndex, ports, setPorts],
  );

  // IDs and port numbers already taken, excluding the entry being edited
  const existingIds = ports.filter((_, i) => i !== editIndex).map((p) => p.id);
  const existingPortNumbers = ports.filter((_, i) => i !== editIndex).map((p) => p.port);
  const editingPort =
    editIndex !== null && editIndex < ports.length ? ports[editIndex] : null;

  return (
    <FormFieldGroupExpandable
      isExpanded
      toggleAriaLabel="Port Details"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Port Configuration',
            id: 'workspace-kind-image-ports',
          }}
          titleDescription="Configure the ports where this image will serve from (at least one required)"
        />
      }
    >
      {ports.length > 0 && (
        <Table aria-label="Ports table" data-testid="ports-table">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Display Name</Th>
              <Th>Port</Th>
              <Th>Protocol</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {ports.map((p, index) => (
              <Tr key={p.id} data-testid={`port-row-${index}`}>
                <Td dataLabel="ID" data-testid={`port-id-cell-${index}`}>
                  {p.id}
                </Td>
                <Td dataLabel="Display Name" data-testid={`port-display-name-cell-${index}`}>
                  {p.displayName || '-'}
                </Td>
                <Td dataLabel="Port" data-testid={`port-number-cell-${index}`}>
                  {p.port}
                </Td>
                <Td dataLabel="Protocol" data-testid={`port-protocol-cell-${index}`}>
                  {p.protocol}
                </Td>
                <Td isActionCell>
                  <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'nowrap' }}>
                    <FlexItem>
                      <Button
                        variant="plain"
                        aria-label={`Edit port ${p.id}`}
                        icon={<PencilAltIcon />}
                        onClick={() => handleEdit(index)}
                        data-testid={`port-edit-${index}`}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="plain"
                        aria-label={`Remove port ${p.id}`}
                        icon={<TrashAltIcon />}
                        isDisabled={ports.length <= 1}
                        onClick={() => handleRemove(index)}
                        data-testid={`port-remove-${index}`}
                      />
                    </FlexItem>
                  </Flex>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <Button
        variant="link"
        icon={<PlusCircleIcon />}
        onClick={() => {
          setEditIndex(null);
          setIsModalOpen(true);
        }}
        data-testid="add-port-button"
      >
        Add Port
      </Button>
      <PortModal
        isOpen={isModalOpen}
        existingPort={editingPort}
        existingIds={existingIds}
        existingPorts={existingPortNumbers}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
      />
    </FormFieldGroupExpandable>
  );
};
