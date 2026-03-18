import * as React from 'react';
import { FormGroup } from '@patternfly/react-core/dist/esm/components/Form';

// Props required by this wrapper component
type ThemeAwareFormGroupWrapperProps = {
  children: React.ReactNode; // The input component
  label?: string;
  fieldId: string;
  isRequired?: boolean;
  helperTextNode?: React.ReactNode; // The pre-rendered HelperText component or null
  hasError?: boolean; // Whether the helper text represents an error (defaults to false)
  className?: string; // Optional className for the outer FormGroup
  role?: string; // Optional role attribute for accessibility
  isInline?: boolean; // Optional isInline prop for FormGroup
  labelHelp?: React.ReactElement; // Optional label help content (e.g. edit icon)
};

const ThemeAwareFormGroupWrapper: React.FC<ThemeAwareFormGroupWrapperProps> = ({
  children,
  label,
  fieldId,
  isRequired,
  helperTextNode,
  hasError = false,
  className,
  role,
  isInline,
  labelHelp,
}) => (
  // Simplified wrapper that always renders standard FormGroup, reverting MUI theme changes
  <FormGroup
    className={`${className || ''} ${hasError ? 'pf-m-error' : ''}`.trim()}
    label={label}
    isRequired={isRequired}
    fieldId={fieldId}
    role={role}
    isInline={isInline}
    labelHelp={labelHelp}
  >
    {children}
    {helperTextNode}
  </FormGroup>
);

export default ThemeAwareFormGroupWrapper;
