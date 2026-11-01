import React from 'react';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { OptionsOptionRedirect, OptionsRedirectMessageLevel } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import {
  REDIRECT_MESSAGE_LEVEL_OPTIONS,
  getRedirectMessageError,
} from '~/app/pages/WorkspaceKinds/Form/helpers';

interface WorkspaceKindFormPodConfigRedirectProps {
  redirect?: OptionsOptionRedirect;
  setRedirect: (obj: OptionsOptionRedirect) => void;
  candidateTargets: { id: string; displayName?: string }[];
}

export const WorkspaceKindFormPodConfigRedirect: React.FC<
  WorkspaceKindFormPodConfigRedirectProps
> = ({ redirect = { to: '' }, setRedirect, candidateTargets }) => {
  const isMissingTarget =
    Boolean(redirect.to) && !candidateTargets.some((target) => target.id === redirect.to);

  const helperTextNode = isMissingTarget ? (
    <HelperText>
      <HelperTextItem variant="warning" data-testid="missing-target-warning">
        The target pod configuration &quot;{redirect.to}&quot; is missing from currently defined
        options.
      </HelperTextItem>
    </HelperText>
  ) : candidateTargets.length === 0 ? (
    <HelperText>
      <HelperTextItem variant="indeterminate">
        No other pod configurations available to redirect to.
      </HelperTextItem>
    </HelperText>
  ) : undefined;

  const textErrorMessage = getRedirectMessageError(redirect);
  const hasTextError = Boolean(textErrorMessage);

  const textHelperText = textErrorMessage ? (
    <HelperText>
      <HelperTextItem variant="error" data-testid="redirect-message-error">
        {textErrorMessage}
      </HelperTextItem>
    </HelperText>
  ) : undefined;

  return (
    <FormFieldGroupExpandable
      toggleAriaLabel="Redirect"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Redirect',
            id: 'workspace-kind-pod-config-redirect',
          }}
        />
      }
      data-testid="workspace-kind-pod-config-redirect-section"
    >
      <ThemeAwareFormGroupWrapper
        label="Redirect To"
        fieldId="workspace-kind-pod-config-redirect-to"
        helperTextNode={helperTextNode}
      >
        <FormSelect
          id="workspace-kind-pod-config-redirect-to"
          data-testid="workspace-kind-pod-config-redirect-to-select"
          aria-label="Redirect To"
          value={redirect.to || ''}
          onChange={(_, val) => {
            if (!val) {
              setRedirect({ to: '' });
            } else {
              setRedirect({
                ...redirect,
                to: val,
                message: redirect.message || {
                  level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
                  text: '',
                },
              });
            }
          }}
        >
          <FormSelectOption key="none" value="" label="Select one (No redirect)" />
          {isMissingTarget && (
            <FormSelectOption
              key={`missing-${redirect.to}`}
              value={redirect.to}
              label={`${redirect.to} (Missing)`}
            />
          )}
          {candidateTargets.map((target) => (
            <FormSelectOption
              key={target.id}
              value={target.id}
              label={target.displayName ? `${target.displayName} (${target.id})` : target.id}
            />
          ))}
        </FormSelect>
      </ThemeAwareFormGroupWrapper>

      {Boolean(redirect.to) && (
        <>
          <ThemeAwareFormGroupWrapper
            label="Redirect Message Level"
            fieldId="workspace-kind-pod-config-redirect-msg-lvl"
          >
            <FormSelect
              id="workspace-kind-pod-config-redirect-msg-lvl"
              data-testid="workspace-kind-pod-config-redirect-msg-lvl-select"
              aria-label="Redirect Message Level"
              value={
                redirect.message?.level || OptionsRedirectMessageLevel.RedirectMessageLevelInfo
              }
              onChange={(_, val) =>
                setRedirect({
                  ...redirect,
                  message: {
                    text: redirect.message?.text || '',
                    level: val as OptionsRedirectMessageLevel,
                  },
                })
              }
            >
              {REDIRECT_MESSAGE_LEVEL_OPTIONS.map((option, index) => (
                <FormSelectOption
                  isDisabled={option.disabled}
                  key={index}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </FormSelect>
          </ThemeAwareFormGroupWrapper>

          <ThemeAwareFormGroupWrapper
            label="Text"
            fieldId="workspace-kind-pod-config-redirect-message-text"
            helperTextNode={textHelperText}
            hasError={hasTextError}
          >
            <TextInput
              name="workspace-kind-pod-config-redirect-message-text"
              type="text"
              id="workspace-kind-pod-config-redirect-message-text"
              data-testid="workspace-kind-pod-config-redirect-message-text-input"
              value={redirect.message?.text || ''}
              validated={hasTextError ? 'error' : 'default'}
              onChange={(_, val) =>
                setRedirect({
                  ...redirect,
                  message: {
                    level:
                      redirect.message?.level ||
                      OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
                    text: val,
                  },
                })
              }
            />
          </ThemeAwareFormGroupWrapper>
        </>
      )}
    </FormFieldGroupExpandable>
  );
};
