import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import {
  OptionsImageConfigValue,
  OptionsPodConfigValue,
  WorkspacesRedirectMessageLevel,
  WorkspacesRedirectStep,
} from '~/generated/data-contracts';

type OptionValue = OptionsImageConfigValue | OptionsPodConfigValue;

interface WorkspaceFormRedirectConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyRedirect: () => void;
  onContinue: () => void;
  optionType: 'image' | 'podConfig';
  selectedOption: OptionValue;
  redirectChain?: WorkspacesRedirectStep[];
  finalTarget?: OptionValue;
}

const getLevelIcon = (level?: string) => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return (
        <Icon status="warning">
          <ExclamationTriangleIcon />
        </Icon>
      );
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return (
        <Icon status="danger">
          <ExclamationCircleIcon />
        </Icon>
      );
    default:
      return (
        <Icon status="info">
          <InfoCircleIcon />
        </Icon>
      );
  }
};

const getLevelColor = (level?: string): 'blue' | 'orange' | 'red' => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return 'orange';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return 'red';
    default:
      return 'blue';
  }
};

const getLevelText = (level?: string): string => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return 'Warning';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return 'Danger';
    default:
      return 'Info';
  }
};

const optionTypeLabel = (optionType: 'image' | 'podConfig'): string =>
  optionType === 'image' ? 'image' : 'pod config';

export const WorkspaceFormRedirectConfirmModal: React.FC<
  WorkspaceFormRedirectConfirmModalProps
> = ({
  isOpen,
  onClose,
  onApplyRedirect,
  onContinue,
  optionType,
  selectedOption,
  redirectChain,
  finalTarget,
}) => {
  const hasRedirect = redirectChain && redirectChain.length > 0;
  const typeLabel = optionTypeLabel(optionType);

  const title = hasRedirect
    ? `${optionType === 'image' ? 'Image' : 'Pod Config'} Redirect`
    : `Hidden ${optionType === 'image' ? 'Image' : 'Pod Config'}`;

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      data-testid="redirect-confirm-modal"
    >
      <ModalHeader title={title} titleIconVariant="warning" />
      <ModalBody>
        <Stack hasGutter>
          {hasRedirect ? (
            <>
              <StackItem>
                <Content>
                  <p>
                    Your administrator has redirected the {typeLabel} you selected (
                    {selectedOption.displayName}).
                    {finalTarget
                      ? ` If you apply the redirect, "${finalTarget.displayName}" will be used instead.`
                      : ' The redirect target could not be resolved.'}
                  </p>
                </Content>
              </StackItem>
              <StackItem>
                <Stack hasGutter>
                  {redirectChain.map((step, index) => (
                    <StackItem key={index}>
                      <Content style={{ display: 'flex', alignItems: 'baseline' }}>
                        {getLevelIcon(step.message?.level)}
                        <ExpandableSection
                          toggleText={` ${step.source.displayName} → ${step.target.displayName}`}
                        >
                          <Stack hasGutter>
                            {step.message && (
                              <>
                                <StackItem>
                                  <Flex
                                    alignItems={{ default: 'alignItemsCenter' }}
                                    spaceItems={{ default: 'spaceItemsSm' }}
                                  >
                                    <FlexItem>
                                      <Label color={getLevelColor(step.message.level)} isCompact>
                                        {getLevelText(step.message.level)}
                                      </Label>
                                    </FlexItem>
                                  </Flex>
                                </StackItem>
                                {step.message.text && (
                                  <StackItem>
                                    <Content>{step.message.text}</Content>
                                  </StackItem>
                                )}
                              </>
                            )}
                          </Stack>
                        </ExpandableSection>
                      </Content>
                    </StackItem>
                  ))}
                </Stack>
              </StackItem>
              {selectedOption.hidden && (
                <StackItem>
                  <Content>
                    <p>
                      <strong>Note:</strong> This {typeLabel} has also been hidden by your
                      administrator.
                    </p>
                  </Content>
                </StackItem>
              )}
            </>
          ) : (
            <StackItem>
              <Content>
                <p>
                  The {typeLabel} you selected <b>{selectedOption.displayName}</b> has been hidden
                  by your administrator. This option may be deprecated or unsupported. You can still
                  use it if you are sure of your choice.
                </p>
              </Content>
            </StackItem>
          )}
        </Stack>
      </ModalBody>
      <ModalFooter>
        {hasRedirect && (
          <Button
            variant="primary"
            onClick={onApplyRedirect}
            isDisabled={!finalTarget}
            data-testid="apply-redirect-button"
          >
            Apply Redirect
          </Button>
        )}
        <Button
          variant={hasRedirect ? 'secondary' : 'primary'}
          onClick={onContinue}
          data-testid="continue-button"
        >
          Continue
        </Button>
        <Button variant="link" onClick={onClose} data-testid="cancel-button">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
