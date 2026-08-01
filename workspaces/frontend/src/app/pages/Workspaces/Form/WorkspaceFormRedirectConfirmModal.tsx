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
  cycleDetected: boolean;
}

const DEFAULT_LEVEL_CONFIG = {
  icon: InfoCircleIcon,
  iconStatus: 'info' as const,
  color: 'blue' as const,
  text: 'Info',
};

const LEVEL_CONFIG: Record<
  WorkspacesRedirectMessageLevel,
  {
    icon: React.ComponentType;
    iconStatus: 'info' | 'warning' | 'danger';
    color: 'blue' | 'orange' | 'red';
    text: string;
  }
> = {
  [WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning]: {
    icon: ExclamationTriangleIcon,
    iconStatus: 'warning',
    color: 'orange',
    text: 'Warning',
  },
  [WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger]: {
    icon: ExclamationCircleIcon,
    iconStatus: 'danger',
    color: 'red',
    text: 'Danger',
  },
  [WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo]: DEFAULT_LEVEL_CONFIG,
};

const getLevelConfig = (level?: WorkspacesRedirectMessageLevel) =>
  level ? LEVEL_CONFIG[level] : DEFAULT_LEVEL_CONFIG;

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
  cycleDetected,
}) => {
  const hasRedirect = redirectChain && redirectChain.length > 0;
  const typeLabel = optionTypeLabel(optionType);
  const typeTitle = optionType === 'image' ? 'Image' : 'Pod Config';

  const title = cycleDetected
    ? `${typeTitle} Redirect Misconfiguration`
    : hasRedirect
      ? `${typeTitle} Redirect`
      : `Hidden ${typeTitle}`;

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
          {cycleDetected ? (
            <StackItem>
              <Content>
                <p>
                  The {typeLabel} you selected (<b>{selectedOption.displayName}</b>) has a circular
                  redirect configuration. This is a misconfiguration that should be reported to your
                  administrator. You can still use the currently selected {typeLabel}, or cancel and
                  choose a different option.
                </p>
              </Content>
            </StackItem>
          ) : hasRedirect ? (
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
                  {redirectChain.map((step, index) => {
                    const config = getLevelConfig(step.message?.level);
                    const LevelIcon = config.icon;
                    return (
                      <StackItem key={index}>
                        <Content style={{ display: 'flex', alignItems: 'baseline' }}>
                          <Icon status={config.iconStatus}>
                            <LevelIcon />
                          </Icon>
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
                                        <Label color={config.color} isCompact>
                                          {config.text}
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
                    );
                  })}
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
                  use it if you are sure of your choice, or cancel and select a different{' '}
                  {typeLabel} from the available options.
                </p>
              </Content>
            </StackItem>
          )}
        </Stack>
      </ModalBody>
      <ModalFooter>
        {hasRedirect && !cycleDetected && (
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
          variant={hasRedirect && !cycleDetected ? 'secondary' : 'primary'}
          onClick={onContinue}
          data-testid="continue-button"
        >
          {cycleDetected
            ? 'Keep Current Selection'
            : hasRedirect
              ? 'Skip Redirect'
              : 'Use Hidden Option'}
        </Button>
        <Button variant="link" onClick={onClose} data-testid="cancel-button">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
