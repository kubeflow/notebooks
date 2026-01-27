/* eslint-disable @typescript-eslint/no-unused-expressions */
import React, { useRef } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import inlineEditStyles from '@patternfly/react-styles/css/components/InlineEdit/inline-edit';
import { css } from '@patternfly/react-styles';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { useThemeContext } from 'mod-arch-kubeflow';
import { WorkspacekindsOptionLabel } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

interface EditableRowInterface {
  data: WorkspacekindsOptionLabel;
  columnNames: ColumnNames<WorkspacekindsOptionLabel>;
  saveChanges: (editedData: WorkspacekindsOptionLabel) => void;
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
  const { isMUITheme } = useThemeContext();

  // Temp fix: Add padding-top utility class for MUI theme until the style is fixed in MUI-theme.scss
  return (
    <Tr className={css(inlineEditStyles.inlineEdit, inlineEditStyles.modifiers.inlineEditable)}>
      <Td
        // TODO: Remove this when https://github.com/opendatahub-io/mod-arch-library/issues/97 is completed.
        className={isMUITheme ? 'pf-v6-u-pt-md' : undefined}
      >
        <ThemeAwareFormGroupWrapper isRequired fieldId="key">
          <TextInput
            aria-label={`${columnNames.key} ${ariaLabel}`}
            id={`${columnNames.key} ${ariaLabel} key`}
            ref={inputRef}
            value={data.key}
            onChange={(e) => saveChanges({ ...data, key: (e.target as HTMLInputElement).value })}
            placeholder="Enter key"
          />
        </ThemeAwareFormGroupWrapper>
      </Td>
      <Td
        // TODO: Remove this when https://github.com/opendatahub-io/mod-arch-library/issues/97 is completed.
        className={isMUITheme ? 'pf-v6-u-pt-md' : undefined}
      >
        <ThemeAwareFormGroupWrapper fieldId="value">
          <TextInput
            aria-label={`${columnNames.value} ${ariaLabel}`}
            id={`${columnNames.value} ${ariaLabel} value`}
            ref={inputRef}
            value={data.value}
            onChange={(e) => saveChanges({ ...data, value: (e.target as HTMLInputElement).value })}
            placeholder="Enter value"
          />
        </ThemeAwareFormGroupWrapper>
      </Td>

      <Td dataLabel="Delete button" className={isMUITheme ? 'pf-v6-u-pt-md' : undefined}>
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
  rows: WorkspacekindsOptionLabel[];
  setRows: (value: WorkspacekindsOptionLabel[]) => void;
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
  const columnNames: ColumnNames<WorkspacekindsOptionLabel> = {
    key: 'Key',
    value: 'Value',
  };

  const dataTestId = title.toLowerCase().replace(/\s+/g, '-');

  return (
    <FormFieldGroupExpandable
      className="form-label-field-group"
      toggleAriaLabel="Labels"
      data-testid={`${dataTestId}-section`}
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
        <Table aria-label="Editable table" data-testid={`${dataTestId}-table`}>
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
        data-testid={`add-${dataTestId}-button`}
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
