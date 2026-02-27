/* eslint-disable @typescript-eslint/no-unused-expressions */
import React, { useRef } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { InputGroup, InputGroupItem } from '@patternfly/react-core/dist/esm/components/InputGroup';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import inlineEditStyles from '@patternfly/react-styles/css/components/InlineEdit/inline-edit';
import { css } from '@patternfly/react-styles';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import PasswordInput from '~/shared/components/PasswordInput';

export type KeyValueRow = { key: string; value: string };

interface EditableTableRowProps {
  data: KeyValueRow;
  columnNames: { key: string; value: string };
  saveChanges: (editedData: KeyValueRow) => void;
  ariaLabel: string;
  deleteRow: () => void;
  valueInputType?: 'text' | 'password';
  isDeleteDisabled?: boolean;
}

const EditableTableRow: React.FC<EditableTableRowProps> = ({
  data,
  columnNames,
  saveChanges,
  ariaLabel,
  deleteRow,
  valueInputType = 'text',
  isDeleteDisabled = false,
}) => {
  const inputRef = useRef(null);

  return (
    <Tr
      data-testid="key-value-pair"
      className={css(inlineEditStyles.inlineEdit, inlineEditStyles.modifiers.inlineEditable)}
    >
      <Td>
        <ThemeAwareFormGroupWrapper isRequired fieldId="key">
          <InputGroup className="editable-rows-table__input-group">
            <InputGroupItem isFill>
              <TextInput
                aria-label={`${columnNames.key} ${ariaLabel}`}
                id={`${columnNames.key} ${ariaLabel} key`}
                ref={inputRef}
                value={data.key}
                onChange={(e) =>
                  saveChanges({ ...data, key: (e.target as HTMLInputElement).value })
                }
                placeholder="Enter key"
                data-testid="key-input"
              />
            </InputGroupItem>
          </InputGroup>
        </ThemeAwareFormGroupWrapper>
      </Td>
      <Td>
        <ThemeAwareFormGroupWrapper fieldId="value" isRequired={valueInputType === 'password'}>
          {valueInputType === 'password' ? (
            <PasswordInput
              aria-label={`${columnNames.value} ${ariaLabel}`}
              value={data.value}
              onChange={(_e, val) => saveChanges({ ...data, value: val })}
              data-testid="value-input"
              className="editable-rows-table__input-group"
            />
          ) : (
            <InputGroup className="editable-rows-table__input-group">
              <InputGroupItem isFill>
                <TextInput
                  aria-label={`${columnNames.value} ${ariaLabel}`}
                  id={`${columnNames.value} ${ariaLabel} value`}
                  ref={inputRef}
                  value={data.value}
                  onChange={(e) =>
                    saveChanges({ ...data, value: (e.target as HTMLInputElement).value })
                  }
                  placeholder="Enter value"
                />
              </InputGroupItem>
            </InputGroup>
          )}
        </ThemeAwareFormGroupWrapper>
      </Td>

      <Td dataLabel="Delete button">
        <Button
          ref={inputRef}
          aria-label={`Delete ${ariaLabel}`}
          onClick={() => deleteRow()}
          variant="plain"
          isDisabled={isDeleteDisabled}
          data-testid="remove-key-value-pair"
        >
          <TrashAltIcon />
        </Button>
      </Td>
    </Tr>
  );
};

interface EditableRowsTableProps {
  rows: KeyValueRow[];
  setRows: (value: KeyValueRow[]) => void;
  title?: string;
  description?: string;
  buttonLabel?: string;
  valueInputType?: 'text' | 'password';
  addButtonTestId?: string;
  isExpanded?: boolean;
  /** When set, delete is disabled when rows.length <= minRows (e.g. 1 = require at least one row). Default 0 = allow deleting all rows. */
  minRows?: number;
}

export const EditableRowsTable: React.FC<EditableRowsTableProps> = ({
  rows,
  setRows,
  title = 'Labels',
  description,
  buttonLabel = 'Label',
  valueInputType = 'text',
  addButtonTestId,
  isExpanded = false,
  minRows = 0,
}) => {
  const columnNames = { key: 'Key', value: 'Value' };

  const dataTestId = title.toLowerCase().replace(/\s+/g, '-');
  const isDeleteDisabled = minRows > 0 && rows.length <= minRows;

  return (
    <FormFieldGroupExpandable
      className="form-label-field-group"
      toggleAriaLabel={title}
      data-testid={`${dataTestId}-section`}
      isExpanded={isExpanded}
      header={
        <FormFieldGroupHeader
          titleText={{
            text: title,
            id: `${dataTestId}-title`,
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
        <Table aria-label="Editable table" data-testid={`${dataTestId}-table`}>
          <Thead>
            <Tr>
              <Th width={45}>{columnNames.key}</Th>
              <Th width={45}>{columnNames.value}</Th>
              <Th screenReaderText="Row edit actions" />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((data, index) => (
              <EditableTableRow
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
                valueInputType={valueInputType}
                isDeleteDisabled={isDeleteDisabled}
              />
            ))}
          </Tbody>
        </Table>
      )}
      <Button
        variant="link"
        style={{ width: 'fit-content' }}
        icon={<PlusCircleIcon />}
        data-testid={addButtonTestId ?? `add-${dataTestId}-button`}
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
