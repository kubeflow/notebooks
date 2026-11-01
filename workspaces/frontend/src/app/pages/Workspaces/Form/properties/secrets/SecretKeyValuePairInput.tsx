import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Tr, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { TimesIcon } from '@patternfly/react-icons/dist/esm/icons/times-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { SecretKeyValuePair } from '~/app/hooks/useSecret';
import PasswordInput from '~/shared/components/PasswordInput';

interface SecretKeyValuePairInputProps {
  index: number;
  row: SecretKeyValuePair;
  onChange: (row: SecretKeyValuePair) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const SecretKeyValuePairInput: React.FC<SecretKeyValuePairInputProps> = ({
  index,
  row,
  onChange,
  onRemove,
  canRemove,
}) => (
  <Tr data-testid="key-value-pair">
    <Td>
      <TextInput
        aria-label={`Key row ${index + 1}`}
        value={row.key}
        readOnlyVariant={row.kind !== 'new' ? 'default' : undefined}
        onChange={(_event, key) => onChange({ ...row, key })}
        placeholder="Enter key"
        data-testid="key-input"
      />
    </Td>
    <Td>
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        flexWrap={{ default: 'nowrap' }}
        spaceItems={{ default: 'spaceItemsXs' }}
      >
        <FlexItem flex={{ default: 'flex_1' }}>
          {row.kind === 'unchanged' ? (
            <span data-testid="undisclosed-value">Undisclosed (kept)</span>
          ) : (
            <PasswordInput
              aria-label={`Value row ${index + 1}`}
              value={row.value}
              onChange={(_event, value) => onChange({ ...row, value })}
              data-testid="value-input"
            />
          )}
        </FlexItem>
        {row.kind === 'unchanged' && (
          <FlexItem>
            <Tooltip content="Replace value">
              <Button
                variant="plain"
                data-testid="replace-secret-value"
                aria-label={`Replace value for ${row.key}`}
                onClick={() => onChange({ key: row.key, kind: 'replacement', value: '' })}
                icon={<PencilAltIcon />}
              />
            </Tooltip>
          </FlexItem>
        )}
        {row.kind === 'replacement' && (
          <FlexItem>
            <Tooltip content="Keep existing value">
              <Button
                variant="plain"
                data-testid="keep-secret-value"
                aria-label={`Keep existing value for ${row.key}`}
                onClick={() => onChange({ key: row.key, kind: 'unchanged' })}
                icon={<TimesIcon />}
              />
            </Tooltip>
          </FlexItem>
        )}
      </Flex>
    </Td>
    <Td>
      <Button
        variant="plain"
        aria-label={`Delete key ${row.key || index + 1}`}
        data-testid="remove-key-value-pair"
        isDisabled={!canRemove}
        onClick={onRemove}
        icon={<TrashAltIcon />}
      />
    </Td>
  </Tr>
);

export default SecretKeyValuePairInput;
