import React from 'react';
import {
  SearchInput,
  SearchInputProps,
} from '@patternfly/react-core/dist/esm/components/SearchInput';

type ThemeAwareSearchInputProps = Omit<SearchInputProps, 'onChange' | 'onClear'> & {
  onChange: (value: string) => void; // Simplified onChange signature
  onClear?: () => void; // Simplified optional onClear signature
  'data-testid'?: string;
};

const ThemeAwareSearchInput: React.FC<ThemeAwareSearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder,
  isDisabled,
  className,
  style,
  'aria-label': ariaLabel = 'Search',
  'data-testid': dataTestId,
  ...rest
}) => (
  // Simplified version using standard PatternFly SearchInput, reverting MUI theme changes
  <SearchInput
    {...rest} // Pass all other applicable SearchInputProps
    className={className}
    style={style}
    placeholder={placeholder}
    value={value}
    isDisabled={isDisabled}
    aria-label={ariaLabel}
    data-testid={dataTestId}
    onChange={(_event, newValue) => onChange(newValue)} // Adapt signature
    onClear={(event) => {
      event.stopPropagation();
      onChange('');
      onClear?.(); // Adapt signature
    }}
  />
);
export default ThemeAwareSearchInput;
