import React from 'react';
import {
  FormGroup,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import {
  WorkspaceOptionRedirect,
  WorkspaceRedirectMessageLevel,
} from '~/shared/api/backendApiTypes';

interface WorkspaceKindFormImageRedirectProps {
  redirect: WorkspaceOptionRedirect;
  setRedirect: (obj: WorkspaceOptionRedirect) => void;
}

export const WorkspaceKindFormImageRedirect: React.FC<WorkspaceKindFormImageRedirectProps> = ({
  redirect,
  setRedirect,
}) => {
  const redirectMsgOptions = [
    { value: 'please choose', label: 'Select one', disabled: true },
    {
      value: WorkspaceRedirectMessageLevel.RedirectMessageLevelInfo,
      label: WorkspaceRedirectMessageLevel.RedirectMessageLevelInfo,
      disabled: false,
    },
    {
      value: WorkspaceRedirectMessageLevel.RedirectMessageLevelWarning,
      label: WorkspaceRedirectMessageLevel.RedirectMessageLevelWarning,
      disabled: false,
    },
    {
      value: WorkspaceRedirectMessageLevel.RedirectMessageLevelDanger,
      label: WorkspaceRedirectMessageLevel.RedirectMessageLevelDanger,
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
      <FormGroup label="Redirect To" isRequired fieldId="redirect-to-id">
        <TextInput
          name="redirect-to-id"
          isRequired
          type="text"
          value={redirect.to}
          onChange={(_, val) => setRedirect({ ...redirect, to: val })}
          id="redirect-to-id"
        />
      </FormGroup>
      <FormGroup label="Redirect Message Level" isRequired fieldId="redirect-msg-lvl">
        <FormSelect
          value={redirect.message?.level || ''}
          onChange={(_, val) =>
            setRedirect({
              ...redirect,
              message: {
                text: redirect.message?.level || '',
                level: val as WorkspaceRedirectMessageLevel,
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
      </FormGroup>
      <FormGroup label="Text" isRequired fieldId="redirect-message-text">
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
                  redirect.message?.level || WorkspaceRedirectMessageLevel.RedirectMessageLevelInfo,
                text: val,
              },
            })
          }
          id="redirect-message-text"
        />
      </FormGroup>
    </FormFieldGroupExpandable>
  );
};
