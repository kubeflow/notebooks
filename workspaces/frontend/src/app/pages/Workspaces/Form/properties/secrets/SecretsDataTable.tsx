import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { SecretKeyValuePair } from '~/app/hooks/useSecret';
import PasswordInput from '~/shared/components/PasswordInput';

interface SecretsDataTableProps {
  rows: SecretKeyValuePair[];
  setRows: (rows: SecretKeyValuePair[]) => void;
  isDisabled: boolean;
  isEditMode: boolean;
}

export const SecretsDataTable: React.FC<SecretsDataTableProps> = ({
  rows,
  setRows,
  isDisabled,
  isEditMode,
}) => {
  const updateRow = (index: number, row: SecretKeyValuePair) =>
    setRows(rows.map((current, i) => (i === index ? row : current)));

  return (
    <FormFieldGroupExpandable
      className="form-label-field-group"
      toggleAriaLabel="Secret data"
      data-testid="secret-data-section"
      isExpanded
      header={
        <FormFieldGroupHeader
          titleText={{ text: 'Secret data', id: 'secret-data-title' }}
          titleDescription={
            isEditMode
              ? 'Existing values are undisclosed and kept unless replaced or deleted. New values are stored as UTF-8 text.'
              : 'Key/value pairs stored in the secret as UTF-8 text.'
          }
        />
      }
    >
      <fieldset
        aria-label="Secret data values"
        disabled={isDisabled}
        className="pf-v6-c-form__fieldset pf-v6-u-p-0 pf-v6-u-m-0"
      >
        {rows.length > 0 && (
          <Table aria-label="Secret data" data-testid="secret-data-table">
            <Thead>
              <Tr>
                <Th width={35}>Key</Th>
                <Th>Value</Th>
                <Th screenReaderText="Row actions" />
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row, index) => (
                <Tr key={index} data-testid="key-value-pair">
                  <Td>
                    <TextInput
                      aria-label={`Key row ${index + 1}`}
                      value={row.key}
                      readOnlyVariant={row.kind !== 'new' ? 'default' : undefined}
                      onChange={(_event, key) => updateRow(index, { ...row, key })}
                      placeholder="Enter key"
                      data-testid="key-input"
                    />
                  </Td>
                  <Td>
                    {row.kind === 'unchanged' ? (
                      <Flex alignItems={{ default: 'alignItemsCenter' }}>
                        <FlexItem data-testid="undisclosed-value">Undisclosed (kept)</FlexItem>
                        <FlexItem>
                          <Button
                            variant="link"
                            data-testid="replace-secret-value"
                            aria-label={`Replace value for ${row.key}`}
                            onClick={() =>
                              updateRow(index, { key: row.key, kind: 'replacement', value: '' })
                            }
                          >
                            Replace
                          </Button>
                        </FlexItem>
                      </Flex>
                    ) : (
                      <>
                        <PasswordInput
                          aria-label={`Value row ${index + 1}`}
                          value={row.value}
                          onChange={(_event, value) => updateRow(index, { ...row, value })}
                          data-testid="value-input"
                        />
                        {row.kind === 'replacement' && (
                          <Button
                            variant="link"
                            data-testid="keep-secret-value"
                            onClick={() => updateRow(index, { key: row.key, kind: 'unchanged' })}
                          >
                            Keep existing value
                          </Button>
                        )}
                      </>
                    )}
                  </Td>
                  <Td>
                    <Button
                      variant="plain"
                      aria-label={`Delete key ${row.key || index + 1}`}
                      data-testid="remove-key-value-pair"
                      isDisabled={!isEditMode && rows.length === 1}
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      icon={<TrashAltIcon />}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        <Button
          variant="link"
          icon={<PlusCircleIcon />}
          data-testid="another-key-value-pair-button"
          onClick={() => setRows([...rows, { key: '', kind: 'new', value: '' }])}
        >
          Add key-value pair
        </Button>
      </fieldset>
    </FormFieldGroupExpandable>
  );
};
