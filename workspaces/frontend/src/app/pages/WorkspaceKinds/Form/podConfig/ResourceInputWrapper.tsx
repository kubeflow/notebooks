import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FormSelect,
  FormSelectOption,
  FormSelectOptionProps,
  NumberInput,
  Split,
  SplitItem,
} from '@patternfly/react-core';

interface ResourceInputWrapperProps {
  value: string;
  onChange: (value: string) => void;
  type: 'cpu' | 'memory' | 'time' | 'custom';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  'aria-label'?: string;
  isDisabled?: boolean;
}

const unitMap: {
  [key: string]: FormSelectOptionProps[];
} = {
  time: [
    { label: 'Minutes', value: 60 },
    { label: 'Hours', value: 60 * 60 },
    { label: 'Days', value: 60 * 60 * 24 },
  ],
  memory: [
    { label: 'MiB', value: 'Mi' },
    { label: 'GiB', value: 'Gi' },
    { label: 'TiB', value: 'Ti' },
  ],
  cpu: [
    { label: 'Cores', value: '' },
    { label: 'Millicores', value: 'm' },
  ],
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

  // Initialize time units with a reasonable default
  useEffect(() => {
    if (type === 'time') {
      const seconds = parseFloat(value) || 0;
      // Choose the most appropriate unit based on the value
      let defaultUnit = 60; // Default to minutes
      if (seconds >= 86400) {
        defaultUnit = 86400; // Days
      } else if (seconds >= 3600) {
        defaultUnit = 3600; // Hours
      } else if (seconds >= 60) {
        defaultUnit = 60; // Minutes
      } else {
        defaultUnit = 1; // Seconds
      }
      setUnit(defaultUnit.toString());
      setInputValue((seconds / defaultUnit).toString());
    }
  }, [type, value]);

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
    } else if (type === 'time') {
      // Time is handled in the first useEffect
      // eslint-disable-next-line no-useless-return
      return;
    } else {
      setInputValue(value);
    }
  }, [value, type]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      if (type === 'memory' || type === 'cpu') {
        onChange(newValue ? `${newValue}${unit}` : '');
      } else if (type === 'time') {
        const numericValue = parseFloat(newValue) || 0;
        const unitMultiplier = parseFloat(unit) || 1;
        onChange(String(numericValue * unitMultiplier));
      } else {
        onChange(newValue);
      }
    },
    [onChange, type, unit],
  );

  const handleUnitChange = useCallback(
    (newUnit: string) => {
      if (type === 'time') {
        const currentValue = parseFloat(inputValue) || 0;
        const oldUnitMultiplier = parseFloat(unit) || 1;
        const newUnitMultiplier = parseFloat(newUnit) || 1;
        // Convert the current value to the new unit
        const valueInSeconds = currentValue * oldUnitMultiplier;
        const valueInNewUnit = valueInSeconds / newUnitMultiplier;
        setUnit(newUnit);
        setInputValue(valueInNewUnit.toString());
        onChange(String(valueInSeconds));
      } else {
        setUnit(newUnit);
        if (inputValue) {
          onChange(`${inputValue}${newUnit}`);
        }
      }
    },
    [inputValue, onChange, type, unit],
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
      unitMap[type].map((u) => <FormSelectOption label={u.label} key={u.label} value={u.value} />),
    [type],
  );

  return (
    <Split>
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
            className="workspace-kind-unit-select"
          >
            {unitOptions}
          </FormSelect>
        )}
      </SplitItem>
    </Split>
  );
};
