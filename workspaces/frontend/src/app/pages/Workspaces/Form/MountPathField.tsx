import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { InputGroup, InputGroupItem } from '@patternfly/react-core/dist/esm/components/InputGroup';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { ValidatedOptions } from '@patternfly/react-core/helpers';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { CheckIcon } from '@patternfly/react-icons/dist/esm/icons/check-icon';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { TimesIcon } from '@patternfly/react-icons/dist/esm/icons/times-icon';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

interface MountPathFieldBaseProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string | null;
  /**
   * When true the mount path is locked (Home Volume). The cell shows a
   * disabled pencil with a tooltip; the input shows a disabled TextInput
   * with a warning helper text.
   */
  isFixed?: boolean;
}

// Table-cell variant
interface MountPathFieldCellProps extends MountPathFieldBaseProps {
  variant: 'cell';
  /** Row index of cell */
  index: number;
  /** Index of the row currently being inline-edited, or null */
  editingIndex: number | null;
  /** Stable id used for aria-labels / data-testid (e.g. pvcName, secretName) */
  itemId: string;
  onStartEdit: (index: number) => void;
}

// Form-input variant
interface MountPathFieldInputProps extends MountPathFieldBaseProps {
  variant: 'input';
  isEditing: boolean;
  onStartEdit: () => void;
  label?: string;
  fieldId?: string;
  placeholder?: string;
  fixedHelperText?: string;
}

export type MountPathFieldProps = MountPathFieldCellProps | MountPathFieldInputProps;

interface EditControlsProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string | null;
  inputId: string;
  inputTestId: string;
  confirmTestId: string;
  cancelTestId: string;
  /** "plain" for cell, "control" for input */
  buttonVariant: 'plain' | 'control';
}

// Shared editing internal component to confirm or cancel edit
const EditControls: React.FC<EditControlsProps> = ({
  value,
  onChange,
  onConfirm,
  onCancel,
  error,
  inputId,
  inputTestId,
  confirmTestId,
  cancelTestId,
  buttonVariant,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Flex
      flexWrap={{ default: 'wrap' }}
      justifyContent={{ default: 'justifyContentSpaceBetween' }}
      className="pf-v6-u-w-100"
    >
      <FlexItem flex={{ default: 'flex_1' }}>
        <TextInput
          id={inputId}
          value={value}
          onChange={(_, val) => onChange(val)}
          validated={error ? ValidatedOptions.error : undefined}
          aria-label="Edit mount path"
          data-testid={inputTestId}
          autoFocus
          onKeyDown={handleKeyDown}
        />
      </FlexItem>
      <FlexItem>
        <Button
          variant={buttonVariant}
          aria-label="Save mount path"
          onClick={onConfirm}
          isDisabled={!!error}
          data-testid={confirmTestId}
        >
          <CheckIcon />
        </Button>
      </FlexItem>
      <FlexItem>
        <Button
          variant={buttonVariant}
          aria-label="Cancel edit"
          onClick={onCancel}
          data-testid={cancelTestId}
        >
          <TimesIcon />
        </Button>
      </FlexItem>
    </Flex>
  );
};

export const MountPathField: React.FC<MountPathFieldProps> = (props) => {
  // Cell variant
  if (props.variant === 'cell') {
    const {
      value,
      onChange,
      onConfirm,
      onCancel,
      error,
      isFixed,
      index,
      editingIndex,
      itemId,
      onStartEdit,
    } = props;

    // Cell: editing mode
    if (editingIndex === index) {
      return (
        <Flex
          alignItems={{ default: 'alignItemsCenter' }}
          spaceItems={{ default: 'spaceItemsXs' }}
          flexWrap={{ default: 'wrap' }}
        >
          <FlexItem flex={{ default: 'flex_1' }}>
            <EditControls
              value={value}
              onChange={onChange}
              onConfirm={onConfirm}
              onCancel={onCancel}
              error={error}
              inputId={`edit-mount-path-${itemId}`}
              inputTestId={`edit-mount-path-input-${itemId}`}
              confirmTestId={`confirm-mount-path-${itemId}`}
              cancelTestId={`cancel-mount-path-${itemId}`}
              buttonVariant="plain"
            />
          </FlexItem>
          {error && (
            <FlexItem fullWidth={{ default: 'fullWidth' }}>
              <HelperText>
                <HelperTextItem variant="error">{error}</HelperTextItem>
              </HelperText>
            </FlexItem>
          )}
        </Flex>
      );
    }

    // Cell: display mode
    const pencilButton = (
      <Button
        variant="plain"
        aria-label="Edit mount path"
        onClick={() => !isFixed && onStartEdit(index)}
        isDisabled={isFixed}
        data-testid={`edit-mount-path-${itemId}`}
      >
        <PencilAltIcon />
      </Button>
    );

    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>{value}</FlexItem>
        <FlexItem>
          {isFixed ? (
            <Tooltip content="The mount path is defined by the workspace kind and cannot be changed.">
              <span>{pencilButton}</span>
            </Tooltip>
          ) : (
            pencilButton
          )}
        </FlexItem>
      </Flex>
    );
  }

  // Form Input variant
  const {
    value,
    onChange,
    onConfirm,
    onCancel,
    error,
    isFixed,
    isEditing,
    onStartEdit,
    label = 'Mount Path',
    fieldId = 'mount-path',
    placeholder = '/data/my-volume',
    fixedHelperText = 'The mount path is defined by the workspace kind and cannot be changed.',
  } = props;

  // Form Input: fixed (home volume)
  if (isFixed) {
    return (
      <ThemeAwareFormGroupWrapper
        label={label}
        isRequired
        fieldId={fieldId}
        helperTextNode={
          <HelperText>
            <HelperTextItem variant="warning">{fixedHelperText}</HelperTextItem>
          </HelperText>
        }
      >
        <TextInput
          id={fieldId}
          name="mountPath"
          isRequired
          type="text"
          value={value}
          isDisabled
          placeholder={placeholder}
          data-testid="mount-path-input"
        />
      </ThemeAwareFormGroupWrapper>
    );
  }

  // Form Input: editing
  return (
    <ThemeAwareFormGroupWrapper
      label={label}
      isRequired
      fieldId={fieldId}
      hasError={!!error}
      className={!isEditing ? 'mount-path-readonly' : ''}
      helperTextNode={
        error ? (
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        ) : null
      }
    >
      {isEditing ? (
        <InputGroup>
          <InputGroupItem isFill>
            <EditControls
              value={value}
              onChange={onChange}
              onConfirm={onConfirm}
              onCancel={onCancel}
              error={error}
              inputId={fieldId}
              inputTestId="mount-path-input"
              confirmTestId="mount-path-save"
              cancelTestId="mount-path-cancel"
              buttonVariant="control"
            />
          </InputGroupItem>
        </InputGroup>
      ) : (
        <InputGroup>
          <InputGroupItem isFill>
            <TextInput
              id={fieldId}
              name="mountPath"
              isRequired
              readOnly
              type="text"
              value={value}
              validated={error ? ValidatedOptions.error : undefined}
              aria-label="Mount path"
              data-testid="mount-path-input"
            />
          </InputGroupItem>
          <InputGroupItem>
            <Button
              variant="control"
              aria-label="Edit mount path"
              onClick={onStartEdit}
              data-testid="mount-path-edit"
            >
              <PencilAltIcon />
            </Button>
          </InputGroupItem>
        </InputGroup>
      )}
    </ThemeAwareFormGroupWrapper>
  );
};
