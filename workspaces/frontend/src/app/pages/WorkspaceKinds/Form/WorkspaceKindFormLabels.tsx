/* eslint-disable @typescript-eslint/no-unused-expressions */
import React, { isValidElement, useRef } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { Button, TextInput } from '@patternfly/react-core';
import inlineEditStyles from '@patternfly/react-styles/css/components/InlineEdit/inline-edit';
import { css } from '@patternfly/react-styles';
import { PlusCircleIcon, TrashAltIcon } from '@patternfly/react-icons';
import { WorkspaceOptionLabel } from '~/shared/api/backendApiTypes';

interface EditableCellProps {
  dataLabel: string;
  staticValue: React.ReactNode;
  editingValue: React.ReactNode;
  role?: string;
  ariaLabel?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  dataLabel,
  staticValue,
  editingValue,
  role,
  ariaLabel,
}) => {
  const hasMultipleInputs =
    Array.isArray(editingValue) && editingValue.every((elem) => isValidElement(elem));

  return (
    <Td dataLabel={dataLabel}>
      <div className={css(inlineEditStyles.inlineEditValue)}>{staticValue}</div>
      {hasMultipleInputs ? (
        <div
          className={css(inlineEditStyles.inlineEditGroup, 'pf-m-column')}
          role={role}
          aria-label={ariaLabel}
        >
          {(editingValue as React.ReactElement<unknown>[]).map((elem, index) => (
            <div key={index} className={css(inlineEditStyles.inlineEditInput)}>
              {elem}
            </div>
          ))}
        </div>
      ) : (
        <div className={css(inlineEditStyles.inlineEditInput)}>{editingValue}</div>
      )}
    </Td>
  );
};

interface EditableRowInterface {
  data: WorkspaceOptionLabel;
  columnNames: ColumnNames<WorkspaceOptionLabel>;
  saveChanges: (editedData: WorkspaceOptionLabel) => void;
  ariaLabel: string;
  deleteRow: () => void;
}

const EditableRow: React.FC<EditableRowInterface> = ({
  data,
  columnNames,
  saveChanges,
  ariaLabel,
  deleteRow,
}) => {
  const inputRef = useRef(null);

  return (
    <Tr className={css(inlineEditStyles.inlineEdit, inlineEditStyles.modifiers.inlineEditable)}>
      <EditableCell
        dataLabel={columnNames.key}
        staticValue={data.key}
        editingValue={
          <TextInput
            aria-label={`${columnNames.key} ${ariaLabel}`}
            id={`${columnNames.key} ${ariaLabel} key`}
            ref={inputRef}
            value={data.key}
            onChange={(e) => saveChanges({ ...data, key: (e.target as HTMLInputElement).value })}
            placeholder="Enter key"
          />
        }
      />
      <EditableCell
        dataLabel={columnNames.value}
        staticValue={data.value}
        editingValue={
          <TextInput
            aria-label={`${columnNames.key} ${ariaLabel}`}
            id={`${columnNames.key} ${ariaLabel} value`}
            ref={inputRef}
            value={data.value}
            onChange={(e) => saveChanges({ ...data, value: (e.target as HTMLInputElement).value })}
            placeholder="Enter value"
          />
        }
      />
      <Td dataLabel="Delete button">
        <Button
          ref={inputRef}
          aria-label={`Delete ${ariaLabel}`}
          onClick={() => deleteRow()}
          variant="plain"
        >
          <TrashAltIcon />
        </Button>
      </Td>
    </Tr>
  );
};

type ColumnNames<T> = { [K in keyof T]: string };

interface WorkspaceKindFormLabelTableProps {
  rows: WorkspaceOptionLabel[];
  setRows: (value: WorkspaceOptionLabel[]) => void;
}

export const WorkspaceKindFormLabelTable: React.FC<WorkspaceKindFormLabelTableProps> = ({
  rows,
  setRows,
}) => {
  const columnNames: ColumnNames<WorkspaceOptionLabel> = {
    key: 'Key',
    value: 'Value',
  };

  return (
    <>
      {rows.length !== 0 && (
        <Table style={{ marginTop: '1rem' }} aria-label="Editable table">
          <Thead>
            <Tr>
              <Th>{columnNames.key}</Th>
              <Th>{columnNames.value}</Th>
              <Th screenReaderText="Row edit actions" />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((data, index) => (
              <EditableRow
                key={index}
                data={data}
                columnNames={columnNames}
                saveChanges={(editedRow) => {
                  setRows(rows.map((row, i) => (i === index ? editedRow : row)));
                }}
                ariaLabel={`row ${index + 1}`}
                deleteRow={() => {
                  setRows(rows.filter((_, i) => i !== index));
                }}
              />
            ))}
          </Tbody>
        </Table>
      )}
      <Button
        variant="link"
        icon={<PlusCircleIcon />}
        onClick={() => {
          setRows([
            ...rows,
            {
              key: '',
              value: '',
            },
          ]);
        }}
      >
        Add Label
      </Button>
    </>
  );
};
