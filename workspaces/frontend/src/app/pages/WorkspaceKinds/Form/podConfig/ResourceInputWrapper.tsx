import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FormSelect,
  FormSelectOption,
  NumberInput,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { CPU_UNITS, MEMORY_UNITS_FOR_SELECTION, UnitOption } from '~/shared/utilities/valueUnits';

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

export const ResourceInputWrapper: React.FC<ResourceInputWrapperProps> = ({
  value,
  onChange,
  min = 0,
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
    if (type === 'memory') {
      // Extract numeric value and unit from memory string (e.g., "512Mi" -> "512" and "Mi")
      const match = value.match(/^(\d+)([MGTP]i)?$/i);
      if (match) {
        setInputValue(match[1]);
        setUnit(match[2] || 'Mi');
      } else {
        setInputValue('');
        setUnit('Mi');
      }
    } else if (type === 'cpu') {
      const match = value.match(/^(\d+)([m])?$/i);
      if (match) {
        setInputValue(match[1]);
        setUnit(match[2] || '');
      } else {
        setInputValue('');
        setUnit('');
      }
    } else {
      setInputValue(value);
    }
  }, [value, type]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      if (type === 'memory' || type === 'cpu') {
        onChange(newValue ? `${newValue}${unit}` : '');
      } else {
        onChange(newValue);
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

  // Memoize the unit options to prevent unnecessary re-renders
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
          value={parseFloat(inputValue) || 0}
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
