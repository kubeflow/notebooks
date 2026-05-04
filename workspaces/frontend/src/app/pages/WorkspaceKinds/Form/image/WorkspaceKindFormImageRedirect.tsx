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
import { OptionsOptionRedirect, OptionsRedirectMessageLevel } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

interface WorkspaceKindFormImageRedirectProps {
  redirect: OptionsOptionRedirect;
  setRedirect: (obj: OptionsOptionRedirect) => void;
}

export const WorkspaceKindFormImageRedirect: React.FC<WorkspaceKindFormImageRedirectProps> = ({
  redirect,
  setRedirect,
}) => {
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
  return (
    <FormFieldGroupExpandable
      toggleAriaLabel="Redirect"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Redirect',
            id: 'workspace-kind-image-redirect',
          }}
        />
      }
    >
      <ThemeAwareFormGroupWrapper label="Redirect To" isRequired fieldId="redirect-to-id">
        <TextInput
          name="redirect-to-id"
          isRequired
          type="text"
          value={redirect.to}
          onChange={(_, val) => setRedirect({ ...redirect, to: val })}
          id="redirect-to-id"
        />
      </ThemeAwareFormGroupWrapper>
      <ThemeAwareFormGroupWrapper
        label="Redirect Message Level"
        isRequired
        fieldId="redirect-msg-lvl"
      >
        <FormSelect
          value={redirect.message?.level || ''}
          onChange={(_, val) =>
            setRedirect({
              ...redirect,
              message: {
                text: redirect.message?.level || '',
                level: val as OptionsRedirectMessageLevel,
              },
            })
          }
          aria-label="Redirect Message Select Input"
          id="redirect-msg-lvl"
          ouiaId="BasicFormSelect"
        >
          {redirectMsgOptions.map((option, index) => (
            <FormSelectOption
              isDisabled={option.disabled}
              key={index}
              value={option.value}
              label={option.label}
            />
          ))}
        </FormSelect>{' '}
      </ThemeAwareFormGroupWrapper>
      <ThemeAwareFormGroupWrapper label="Text" isRequired fieldId="redirect-message-text">
        <TextInput
          name="redirect-message-text"
          isRequired
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
        />
      </ThemeAwareFormGroupWrapper>
    </FormFieldGroupExpandable>
  );
};
