/* eslint-disable @typescript-eslint/no-unused-expressions */
import React, { useRef } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  Button,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  TextInput,
} from '@patternfly/react-core';
import inlineEditStyles from '@patternfly/react-styles/css/components/InlineEdit/inline-edit';
import { css } from '@patternfly/react-styles';
import { PlusCircleIcon, TrashAltIcon } from '@patternfly/react-icons';
import { WorkspaceOptionLabel } from '~/shared/api/backendApiTypes';

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
      <Td>
        <TextInput
          aria-label={`${columnNames.key} ${ariaLabel}`}
          id={`${columnNames.key} ${ariaLabel} key`}
          ref={inputRef}
          value={data.key}
          onChange={(e) => saveChanges({ ...data, key: (e.target as HTMLInputElement).value })}
          placeholder="Enter key"
        />
      </Td>
      <Td>
        <TextInput
          aria-label={`${columnNames.key} ${ariaLabel}`}
          id={`${columnNames.key} ${ariaLabel} value`}
          ref={inputRef}
          value={data.value}
          onChange={(e) => saveChanges({ ...data, value: (e.target as HTMLInputElement).value })}
          placeholder="Enter value"
        />
      </Td>

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

interface EditableLabelsProps {
  rows: WorkspaceOptionLabel[];
  setRows: (value: WorkspaceOptionLabel[]) => void;
  title?: string;
  description?: string;
  buttonLabel?: string;
}

export const EditableLabels: React.FC<EditableLabelsProps> = ({
  rows,
  setRows,
  title = 'Labels',
  description,
  buttonLabel = 'Label',
}) => {
  const columnNames: ColumnNames<WorkspaceOptionLabel> = {
    key: 'Key',
    value: 'Value',
  };

  return (
    <FormFieldGroupExpandable
      className="form-label-field-group"
      toggleAriaLabel="Labels"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: title,
            id: `${title}-labels`,
          }}
          titleDescription={
            <>
              <div>
                {description ||
                  'Labels are key/value pairs that are attached to Kubernetes objects.'}
              </div>
              <div className="pf-u-font-size-sm">
                <strong>{rows.length} added</strong>
              </div>
            </>
          }
        />
      }
    >
      {rows.length !== 0 && (
        <Table aria-label="Editable table">
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
        style={{ width: 'fit-content' }}
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
        {`Add ${buttonLabel}`}
      </Button>
    </FormFieldGroupExpandable>
  );
};
