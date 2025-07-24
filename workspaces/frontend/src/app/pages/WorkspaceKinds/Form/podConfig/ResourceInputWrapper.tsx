import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { NumberInput } from '@patternfly/react-core/dist/esm/components/NumberInput';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import {
  CPU_UNITS,
  MEMORY_UNITS_FOR_SELECTION,
  TIME_UNIT_FOR_SELECTION,
  UnitOption,
} from '~/shared/utilities/valueUnits';
import { parseResourceValue } from '~/shared/utilities/WorkspaceUtils';

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
  [key: string]: UnitOption[];
} = {
  memory: MEMORY_UNITS_FOR_SELECTION,
  cpu: CPU_UNITS,
  time: TIME_UNIT_FOR_SELECTION,
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
  const isTimeInitialized = useRef(false);

  useEffect(() => {
    if (type === 'time') {
      // Initialize time only once
      if (!isTimeInitialized.current) {
        const seconds = parseFloat(value) || 0;
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
        isTimeInitialized.current = true;
      }
    } else {
      if (type === 'custom') {
        setInputValue(value);
        return;
      }
      const [numericValue, extractedUnit] = parseResourceValue(value, type);
      setInputValue(String(numericValue || ''));
      setUnit(extractedUnit?.unit || DEFAULT_UNITS[type]);
    }
  }, [type, value]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      if (type === 'custom') {
        onChange(newValue);
      } else if (type === 'time') {
        const numericValue = parseFloat(newValue) || 0;
        const unitMultiplier = parseFloat(unit) || 1;
        onChange(String(numericValue * unitMultiplier));
      } else {
        onChange(newValue ? `${newValue}${unit}` : '');
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

  const unitOptions = useMemo(
    () =>
      type !== 'custom'
        ? unitMap[type].map((u) => (
            <FormSelectOption
              label={u.name}
              key={u.name}
              value={type === 'time' ? u.weight : u.unit}
            />
          ))
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
            className="workspace-kind-unit-select"
          >
            {unitOptions}
          </FormSelect>
        )}
      </SplitItem>
    </Split>
  );
};
