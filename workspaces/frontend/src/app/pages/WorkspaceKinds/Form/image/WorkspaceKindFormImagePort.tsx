import React, { useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { WorkspaceKindImagePort } from '~/app/types';
import { V1Beta1WorkspaceKindPort } from '~/generated/data-contracts';
import { EditableTableSection } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import { validatePort } from '~/app/pages/WorkspaceKinds/Form/helpers';

interface WorkspaceKindFormImagePortProps {
  ports: WorkspaceKindImagePort[];
  setPorts: (ports: WorkspaceKindImagePort[]) => void;
  declaredPorts?: V1Beta1WorkspaceKindPort[];
}

export const WorkspaceKindFormImagePort: React.FC<WorkspaceKindFormImagePortProps> = ({
  ports,
  setPorts,
  declaredPorts = [],
}) => {
  // All rows that existed on first render start as touched (they already have data).
  // Newly added rows become touched on first field interaction.
  const [touchedRows, setTouchedRows] = useState<Set<number>>(
    () => new Set(ports.map((_, i) => i)),
  );

  // Local string state for the port-number text field, so intermediate values (e.g. typing
  // "8" before "88") don't get coerced to a numeric representation between keystrokes.
  const [portInputs, setPortInputs] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    ports.forEach((p, i) => {
      init[i] = String(p.port);
    });
    return init;
  });

  const markTouched = (index: number) => {
    setTouchedRows((prev) => {
      if (prev.has(index)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const updatePort = (index: number, update: Partial<WorkspaceKindImagePort>) => {
    markTouched(index);
    setPorts(ports.map((p, i) => (i === index ? { ...p, ...update } : p)));
  };

  const handlePortNumberChange = (index: number, val: string) => {
    setPortInputs((prev) => ({ ...prev, [index]: val }));
    const num = Number(val);
    updatePort(index, { port: Number.isNaN(num) ? 0 : num });
  };

  const addPort = () => {
    const newIndex = ports.length;
    setPortInputs((prev) => ({ ...prev, [newIndex]: '8888' }));
    // New row intentionally not added to touchedRows — errors won't show until first interaction.
    setPorts([...ports, { id: '', displayName: '', port: 8888, protocol: 'HTTP' }]);
  };

  const removePort = (index: number) => {
    // Shift touched indices down past the removed row.
    setTouchedRows((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) {
          next.add(i);
        } else if (i > index) {
          next.add(i - 1);
        }
      });
      return next;
    });
    setPortInputs((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) {
          next[ki] = v;
        } else if (ki > index) {
          next[ki - 1] = v;
        }
      });
      return next;
    });
    setPorts(ports.filter((_, i) => i !== index));
  };

  return (
    <EditableTableSection
      title="Port Configuration"
      description="Configure the ports where this image will serve from (at least one required)"
      buttonLabel="Port"
      addButtonTestId="add-port-button"
      isExpanded
      onAdd={addPort}
      showRowCount={false}
    >
      {ports.length > 0 && (
        <Table aria-label="Ports table" data-testid="ports-table">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Display Name</Th>
              <Th>Port</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {ports.map((p, index) => {
              const isTouched = touchedRows.has(index);
              const errors = isTouched ? validatePort(p, index, ports, declaredPorts) : {};

              return (
                <Tr key={index} data-testid={`port-row-${index}`}>
                  <Td dataLabel="ID" data-testid={`port-id-cell-${index}`}>
                    {declaredPorts.length > 0 ? (
                      <>
                        <FormSelect
                          value={p.id}
                          onChange={(_, val) => updatePort(index, { id: val })}
                          aria-label={`Port ID for row ${index}`}
                          id={`port-id-select-${index}`}
                          data-testid={`port-id-select-${index}`}
                          validated={isTouched && errors.id ? 'error' : 'default'}
                        >
                          <FormSelectOption value="" label="Select ID" />
                          {declaredPorts.map((dp) => (
                            <FormSelectOption key={dp.id} value={dp.id} label={dp.id} />
                          ))}
                        </FormSelect>
                        {isTouched && errors.id && (
                          <HelperText>
                            <HelperTextItem variant="error">{errors.id}</HelperTextItem>
                          </HelperText>
                        )}
                      </>
                    ) : (
                      <>
                        <TextInput
                          value={p.id}
                          onChange={(_, val) => updatePort(index, { id: val })}
                          type="text"
                          aria-label={`Port ID for row ${index}`}
                          id={`port-id-input-${index}`}
                          data-testid={`port-id-input-${index}`}
                          validated={isTouched && errors.id ? 'error' : 'default'}
                        />
                        {isTouched && errors.id && (
                          <HelperText>
                            <HelperTextItem variant="error">{errors.id}</HelperTextItem>
                          </HelperText>
                        )}
                      </>
                    )}
                  </Td>
                  <Td dataLabel="Display Name" data-testid={`port-display-name-cell-${index}`}>
                    <TextInput
                      value={p.displayName}
                      onChange={(_, val) => updatePort(index, { displayName: val })}
                      type="text"
                      aria-label={`Display name for row ${index}`}
                      id={`port-display-name-input-${index}`}
                      data-testid={`port-display-name-input-${index}`}
                      validated={isTouched && errors.displayName ? 'error' : 'default'}
                    />
                    {isTouched && errors.displayName && (
                      <HelperText>
                        <HelperTextItem variant="error">{errors.displayName}</HelperTextItem>
                      </HelperText>
                    )}
                  </Td>
                  <Td dataLabel="Port" data-testid={`port-number-cell-${index}`}>
                    <TextInput
                      value={portInputs[index] ?? String(p.port)}
                      onChange={(_, val) => handlePortNumberChange(index, val)}
                      type="number"
                      aria-label={`Port number for row ${index}`}
                      id={`port-number-input-${index}`}
                      data-testid={`port-number-input-${index}`}
                      validated={isTouched && errors.port ? 'error' : 'default'}
                    />
                    {isTouched && errors.port && (
                      <HelperText>
                        <HelperTextItem variant="error">{errors.port}</HelperTextItem>
                      </HelperText>
                    )}
                  </Td>
                  <Td isActionCell>
                    <Button
                      variant="plain"
                      aria-label={`Remove port ${index}`}
                      icon={<TrashAltIcon />}
                      isDisabled={ports.length <= 1}
                      onClick={() => removePort(index)}
                      data-testid={`port-remove-${index}`}
                    />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </EditableTableSection>
  );
};
