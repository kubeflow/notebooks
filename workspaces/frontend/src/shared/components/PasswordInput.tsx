import React, { useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { InputGroup, InputGroupItem } from '@patternfly/react-core/dist/esm/components/InputGroup';
import { TextInput, TextInputTypes } from '@patternfly/react-core/dist/esm/components/TextInput';
import { EyeIcon } from '@patternfly/react-icons/dist/esm/icons/eye-icon';
import { EyeSlashIcon } from '@patternfly/react-icons/dist/esm/icons/eye-slash-icon';

interface PasswordInputProps {
  value: string;
  onChange: (event: React.FormEvent<HTMLInputElement>, value: string) => void;
  'aria-label': string;
  isRequired?: boolean;
  'data-testid'?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  'aria-label': ariaLabel,
  isRequired = false,
  'data-testid': dataTestId,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputGroup>
      <InputGroupItem isFill>
        <TextInput
          type={showPassword ? TextInputTypes.text : TextInputTypes.password}
          value={value}
          onChange={onChange}
          aria-label={ariaLabel}
          isRequired={isRequired}
          data-testid={dataTestId}
        />
      </InputGroupItem>
      <InputGroupItem>
        <Button
          variant="control"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
        </Button>
      </InputGroupItem>
    </InputGroup>
  );
};

export default PasswordInput;
