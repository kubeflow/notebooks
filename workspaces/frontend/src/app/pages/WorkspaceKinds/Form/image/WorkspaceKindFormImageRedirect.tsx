import React from 'react';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { OptionsOptionRedirect, OptionsRedirectMessageLevel } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

export interface RedirectTargetOption {
  id: string;
  displayName?: string;
}

export interface WorkspaceKindFormImageRedirectProps {
  redirect: OptionsOptionRedirect;
  setRedirect: (obj: OptionsOptionRedirect) => void;
  eligibleTargets?: RedirectTargetOption[];
  configurationType?: 'image' | 'pod';
  isExpanded?: boolean;
}

export const WorkspaceKindFormImageRedirect: React.FC<WorkspaceKindFormImageRedirectProps> = ({
  redirect,
  setRedirect,
  eligibleTargets = [],
  configurationType = 'image',
  isExpanded: isExpandedProp,
}) => {
  const isExpanded = isExpandedProp ?? Boolean(redirect.to);
  const redirectMsgOptions = [
    { value: 'please choose', label: 'Select one', disabled: true },
    {
      value: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
      label: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
      disabled: false,
    },
    {
      value: OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
      label: OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
      disabled: false,
    },
    {
      value: OptionsRedirectMessageLevel.RedirectMessageLevelDanger,
      label: OptionsRedirectMessageLevel.RedirectMessageLevelDanger,
      disabled: false,
    },
  ];

  const hasTargets = eligibleTargets.length > 0;
  const isTargetMissing = Boolean(
    redirect.to && !eligibleTargets.some((target) => target.id === redirect.to),
  );

  return (
    <FormFieldGroupExpandable
      toggleAriaLabel="Redirect"
      isExpanded={isExpanded}
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Redirect',
            id: 'workspace-kind-image-redirect',
          }}
        />
      }
    >
      <ThemeAwareFormGroupWrapper
        label="Redirect To"
        fieldId="redirect-to-id"
        hasError={isTargetMissing}
        helperTextNode={
          isTargetMissing ? (
            <HelperText>
              <HelperTextItem variant="error" data-testid="redirect-missing-target-error">
                Target configuration &quot;{redirect.to}&quot; does not exist. Select an existing
                configuration or clear the redirect.
              </HelperTextItem>
            </HelperText>
          ) : !hasTargets ? (
            <HelperText>
              <HelperTextItem variant="indeterminate" data-testid="redirect-no-targets-helper">
                At least one other {configurationType} configuration must exist to configure a
                redirect.
              </HelperTextItem>
            </HelperText>
          ) : undefined
        }
      >
        <FormSelect
          name="redirect-to-id"
          value={redirect.to || ''}
          onChange={(_, val) => setRedirect({ ...redirect, to: val })}
          id="redirect-to-id"
          data-testid="redirect-to-select"
          aria-label="Redirect Target Select Input"
          isDisabled={!hasTargets && !isTargetMissing}
          validated={isTargetMissing ? 'error' : 'default'}
        >
          {!hasTargets && !isTargetMissing ? (
            <FormSelectOption
              key="no-targets"
              value=""
              label={`No eligible ${configurationType} redirect targets available`}
              isDisabled
            />
          ) : (
            <FormSelectOption key="none" value="" label="Select a target..." />
          )}

          {isTargetMissing && (
            <FormSelectOption
              key="missing-target"
              value={redirect.to}
              label={`${redirect.to} (Target missing or deleted)`}
              isDisabled
            />
          )}

          {eligibleTargets.map((target) => {
            const label =
              target.displayName && target.displayName !== target.id
                ? `${target.displayName} (${target.id})`
                : target.id;
            return <FormSelectOption key={target.id} value={target.id} label={label} />;
          })}
        </FormSelect>
      </ThemeAwareFormGroupWrapper>

      <ThemeAwareFormGroupWrapper label="Redirect Message Level" fieldId="redirect-msg-lvl">
        <FormSelect
          value={redirect.message?.level || ''}
          onChange={(_, val) =>
            setRedirect({
              ...redirect,
              message: {
                level: val as OptionsRedirectMessageLevel,
                text: redirect.message?.text || '',
              },
            })
          }
          aria-label="Redirect Message Select Input"
          id="redirect-msg-lvl"
          ouiaId="BasicFormSelect"
          data-testid="redirect-msg-level-select"
          isDisabled={!redirect.to}
        >
          {redirectMsgOptions.map((option, index) => (
            <FormSelectOption
              isDisabled={option.disabled}
              key={index}
              value={option.value}
              label={option.label}
            />
          ))}
        </FormSelect>
      </ThemeAwareFormGroupWrapper>

      <ThemeAwareFormGroupWrapper label="Text" fieldId="redirect-message-text">
        <TextInput
          name="redirect-message-text"
          type="text"
          value={redirect.message?.text || ''}
          onChange={(_, val) =>
            setRedirect({
              ...redirect,
              message: {
                level:
                  redirect.message?.level || OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
                text: val,
              },
            })
          }
          id="redirect-message-text"
          data-testid="redirect-message-text-input"
          isDisabled={!redirect.to}
        />
      </ThemeAwareFormGroupWrapper>
    </FormFieldGroupExpandable>
  );
};

export const WorkspaceKindFormRedirect = WorkspaceKindFormImageRedirect;
export type WorkspaceKindFormRedirectProps = WorkspaceKindFormImageRedirectProps;
