import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FormSelect,
  FormSelectOption,
  NumberInput,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { CPU_UNITS, MEMORY_UNITS_FOR_SELECTION, UnitOption } from '~/shared/utilities/valueUnits';
import { parseResourceValue } from '~/shared/utilities/WorkspaceUtils';

interface ResourceInputWrapperProps {
  value: string;
  onChange: (value: string) => void;
  type: 'cpu' | 'memory' | 'custom';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  'aria-label'?: string;
  isDisabled?: boolean;
}

const unitMap: {
  [key: string]: UnitOption[];
} = {
  memory: MEMORY_UNITS_FOR_SELECTION,
  cpu: CPU_UNITS,
};

const DEFAULT_STEP = 1;

const DEFAULT_UNITS = {
  memory: 'Mi',
  cpu: '',
};

export const ResourceInputWrapper: React.FC<ResourceInputWrapperProps> = ({
  value,
  onChange,
  min = 1,
  max,
  step = DEFAULT_STEP,
  type,
  placeholder,
  'aria-label': ariaLabel,
  isDisabled = false,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [unit, setUnit] = useState<string>('');

  useEffect(() => {
    if (type === 'custom') {
      setInputValue(value);
      return;
    }
    const [numericValue, extractedUnit] = parseResourceValue(value, type);
    setInputValue(String(numericValue || ''));
    setUnit(extractedUnit?.unit || DEFAULT_UNITS[type]);
  }, [value, type]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      if (type === 'custom') {
        onChange(newValue);
      } else {
        onChange(newValue ? `${newValue}${unit}` : '');
      }
    },
    [onChange, type, unit],
  );

  const handleUnitChange = useCallback(
    (newUnit: string) => {
      setUnit(newUnit);
      if (inputValue) {
        onChange(`${inputValue}${newUnit}`);
      }
    },
    [inputValue, onChange],
  );

  const handleIncrement = useCallback(() => {
    const currentValue = parseFloat(inputValue) || 0;
    const newValue = Math.min(currentValue + step, max || Infinity);
    handleInputChange(newValue.toString());
  }, [inputValue, step, max, handleInputChange]);

  const handleDecrement = useCallback(() => {
    const currentValue = parseFloat(inputValue) || 0;
    const newValue = Math.max(currentValue - step, min);
    handleInputChange(newValue.toString());
  }, [inputValue, step, min, handleInputChange]);

  const handleNumberInputChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newValue = (event.target as HTMLInputElement).value;
      handleInputChange(newValue);
    },
    [handleInputChange],
  );

  const unitOptions = useMemo(
    () =>
      type !== 'custom'
        ? unitMap[type].map((u) => <FormSelectOption label={u.name} key={u.name} value={u.unit} />)
        : [],
    [type],
  );

  return (
    <Split className="workspacekind-form-resource-input">
      <SplitItem>
        <NumberInput
          value={parseFloat(inputValue) || 1}
          placeholder={placeholder}
          onMinus={handleDecrement}
          onChange={handleNumberInputChange}
          onPlus={handleIncrement}
          inputAriaLabel={ariaLabel}
          minusBtnAriaLabel={`${ariaLabel}-minus`}
          plusBtnAriaLabel={`${ariaLabel}-plus`}
          inputName={`${ariaLabel}-input`}
          id={ariaLabel}
          isDisabled={isDisabled}
          min={min}
          max={max}
          step={step}
        />
      </SplitItem>
      <SplitItem>
        {type !== 'custom' && (
          <FormSelect
            value={unit}
            onChange={(_, v) => handleUnitChange(v)}
            id={`${ariaLabel}-unit-select`}
            isDisabled={isDisabled}
          >
            {unitOptions}
          </FormSelect>
        )}
      </SplitItem>
    </Split>
  );
};
