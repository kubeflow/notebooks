import React from 'react';
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { WorkspacesRedirectStep } from '~/generated/data-contracts';
import { getMessageLevelColor, getMessageLevelText } from '~/shared/utilities/RedirectUtils';

interface RedirectConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  redirectChain: WorkspacesRedirectStep[];
  isHidden?: boolean;
}

export const RedirectConfirmationModal: React.FC<RedirectConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  redirectChain,
  isHidden,
}) => (
  <Modal
    variant={ModalVariant.medium}
    isOpen={isOpen}
    onClose={onCancel}
    data-testid="redirect-confirmation-modal"
  >
    <ModalHeader
      title={isHidden ? 'Hidden Option Selected' : 'Redirected Option Selected'}
      titleIconVariant="warning"
    />
    <ModalBody>
      <Stack hasGutter>
        <StackItem>
          {isHidden
            ? 'The option you selected has been hidden or deprecated. Selecting this option may result in using a configuration that is no longer recommended.'
            : 'Your administrator has redirected the option you selected. The following redirect chain will be applied:'}
        </StackItem>
        {!isHidden && (
          <StackItem>
            <Stack hasGutter>
              {redirectChain.map((step, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <StackItem>
                      <Divider />
                    </StackItem>
                  )}
                  <StackItem>
                    <Stack hasGutter>
                      <StackItem>
                        <Flex
                          alignItems={{ default: 'alignItemsCenter' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          {step.message && (
                            <FlexItem>
                              <Label color={getMessageLevelColor(step.message.level)}>
                                {getMessageLevelText(step.message.level)}
                              </Label>
                            </FlexItem>
                          )}
                          <FlexItem>
                            <strong>
                              {step.source.displayName} → {step.target.displayName}
                            </strong>
                          </FlexItem>
                        </Flex>
                      </StackItem>
                      {step.message?.text && <StackItem>{step.message.text}</StackItem>}
                    </Stack>
                  </StackItem>
                </React.Fragment>
              ))}
            </Stack>
          </StackItem>
        )}
        <StackItem>
          {isHidden
            ? 'Are you sure you want to proceed with this hidden option?'
            : 'Do you want to apply the redirect and proceed?'}
        </StackItem>
      </Stack>
    </ModalBody>
    <ModalFooter>
      <Button key="confirm" variant="primary" onClick={onConfirm} data-testid="confirm-button">
        Confirm
      </Button>
      <Button key="cancel" variant="link" onClick={onCancel} data-testid="cancel-button">
        Cancel
      </Button>
    </ModalFooter>
  </Modal>
);
