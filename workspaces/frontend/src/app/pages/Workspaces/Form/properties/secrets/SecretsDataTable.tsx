import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { Table, Thead, Tbody, Tr, Th } from '@patternfly/react-table/dist/esm/components/Table';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { SecretKeyValuePair } from '~/app/hooks/useSecret';
import SecretKeyValuePairInput from '~/app/pages/Workspaces/Form/properties/secrets/SecretKeyValuePairInput';

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
}) => (
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
              <SecretKeyValuePairInput
                key={index}
                index={index}
                row={row}
                onChange={(updatedRow) =>
                  setRows(rows.map((current, i) => (i === index ? updatedRow : current)))
                }
                onRemove={() => setRows(rows.filter((_, i) => i !== index))}
                canRemove={isEditMode || rows.length > 1}
              />
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
