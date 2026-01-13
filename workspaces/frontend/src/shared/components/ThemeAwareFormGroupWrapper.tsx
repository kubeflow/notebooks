import * as React from 'react';
import { FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { useThemeContext } from 'mod-arch-kubeflow';
import FormFieldset from '~/app/components/FormFieldset';

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
  skipFieldset?: boolean; // If true, skip wrapping in FormFieldset (for NumberInput, etc.)
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
  skipFieldset = false,
}) => {
  const { isMUITheme } = useThemeContext();

  if (isMUITheme && !skipFieldset) {
    // For MUI theme, render FormGroup -> FormFieldset -> Input
    // Helper text is rendered *after* the FormGroup wrapper
    return (
      <>
        <FormGroup
          className={`${className || ''} ${hasError ? 'pf-m-error' : ''}`.trim()} // Apply className and error state class
          label={label}
          isRequired={isRequired}
          fieldId={fieldId}
          role={role}
          isInline={isInline}
        >
          <FormFieldset component={children} field={label} />
        </FormGroup>
        {helperTextNode}
      </>
    );
  }

  if (isMUITheme && skipFieldset) {
    // For MUI theme with skipFieldset, render FormGroup -> Input (no FormFieldset)
    // This is for components like NumberInput that don't need the fieldset wrapper
    return (
      <>
        <FormGroup
          className={`${className || ''} ${hasError ? 'pf-m-error' : ''}`.trim()} // Apply className and error state class
          label={label}
          isRequired={isRequired}
          fieldId={fieldId}
          role={role}
          isInline={isInline}
        >
          {children}
        </FormGroup>
        {helperTextNode}
      </>
    );
  }

  // For PF theme, render standard FormGroup
  return (
    <>
      <FormGroup
        className={`${className || ''} ${hasError ? 'pf-m-error' : ''}`.trim()} // Apply className and error state class
        label={label}
        isRequired={isRequired}
        fieldId={fieldId}
        role={role}
        isInline={isInline}
      >
        {children}
        {helperTextNode}
      </FormGroup>
    </>
  );
};

export default ThemeAwareFormGroupWrapper;
