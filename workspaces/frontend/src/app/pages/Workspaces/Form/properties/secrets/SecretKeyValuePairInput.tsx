import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Grid, GridItem } from '@patternfly/react-core/dist/esm/layouts/Grid';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { MinusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/minus-circle-icon';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import PasswordInput from '~/shared/components/PasswordInput';

interface SecretKeyValuePairInputProps {
  index: number;
  keyValue: string;
  valueValue: string;
  onKeyChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

/**
 * A composite component for managing a single secret key-value pair
 * Handles layout and semantics for Key input, Value input, and Remove button
 */
const SecretKeyValuePairInput: React.FC<SecretKeyValuePairInputProps> = ({
  index,
  keyValue,
  valueValue,
  onKeyChange,
  onValueChange,
  onRemove,
  canRemove,
}) => (
  <>
    <Grid hasGutter data-testid="key-value-pair">
      <GridItem span={11}>
        <Form>
          <ThemeAwareFormGroupWrapper isRequired label="Key" fieldId={`key-${index}`}>
            <TextInput
              id={`key-${index}`}
              data-testid="key-input"
              isRequired
              aria-label={`key of item ${index}`}
              value={keyValue}
              onChange={(_event, val) => onKeyChange(val)}
            />
          </ThemeAwareFormGroupWrapper>
        </Form>
      </GridItem>
      <GridItem span={1} className="secret-remove-button-container">
        <Stack className="pf-v6-u-justify-content-flex-end">
          <Button
            isDisabled={!canRemove}
            data-testid="remove-key-value-pair"
            aria-label="Remove key-value pair"
            variant="plain"
            icon={<MinusCircleIcon />}
            onClick={onRemove}
          />
        </Stack>
      </GridItem>
    </Grid>
    <ThemeAwareFormGroupWrapper isRequired label="Value" fieldId={`value-${index}`}>
      <PasswordInput
        data-testid="value-input"
        isRequired
        aria-label={`value of item ${index}`}
        value={valueValue}
        onChange={(_event, val) => onValueChange(val)}
      />
    </ThemeAwareFormGroupWrapper>
  </>
);

export default SecretKeyValuePairInput;
