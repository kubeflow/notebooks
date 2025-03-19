import * as React from 'react';
import {
  Button,
  Content,
  Flex,
  FlexItem,
  PageGroup,
  PageSection,
  ProgressStep,
  ProgressStepper,
} from '@patternfly/react-core';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceCreationImageSelection } from '~/app/pages/Workspaces/Creation/WorkspaceCreationImageSelection';
import { WorkspaceCreationKindSelection } from '~/app/pages/Workspaces/Creation/WorkspaceCreationKindSelection';
import { WorkspaceCreationPropertiesSelection } from '~/app/pages/Workspaces/Creation/WorkspaceCreationPropertiesSelection';

enum WorkspaceCreationSteps {
  KindSelection,
  ImageSelection,
  Properties,
}

const WorkspaceCreation: React.FunctionComponent = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(WorkspaceCreationSteps.KindSelection);

  const getStepVariant = useCallback(
    (step: WorkspaceCreationSteps) => {
      if (step > currentStep) {
        return 'pending';
      }
      if (step < currentStep) {
        return 'success';
      }
      return 'info';
    },
    [currentStep],
  );

  const previousStep = useCallback(() => {
    setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const nextStep = useCallback(() => {
    setCurrentStep(currentStep + 1);
  }, [currentStep]);

  const cancel = useCallback(() => {
    navigate('/workspaces');
  }, [navigate]);

  return (
    <>
      <PageGroup stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection isFilled={false}>
          <Content>
            <h1>Create workspace</h1>
          </Content>
          <ProgressStepper aria-label="Workspace creation stepper">
            <ProgressStep
              variant={getStepVariant(WorkspaceCreationSteps.KindSelection)}
              id="kind-selection-step"
              titleId="kind-selection-step-title"
              aria-label="Kind selection step"
            >
              Kind selection
            </ProgressStep>
            <ProgressStep
              variant={getStepVariant(WorkspaceCreationSteps.ImageSelection)}
              isCurrent
              id="image-selection-step"
              titleId="image-selection-step-title"
              aria-label="Image selection step"
            >
              Image selection
            </ProgressStep>
            <ProgressStep
              variant={getStepVariant(WorkspaceCreationSteps.Properties)}
              id="properties-step"
              titleId="properties-step-title"
              aria-label="Properties step"
            >
              Properties
            </ProgressStep>
          </ProgressStepper>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {currentStep === WorkspaceCreationSteps.KindSelection && <WorkspaceCreationKindSelection />}
        {currentStep === WorkspaceCreationSteps.ImageSelection && (
          <WorkspaceCreationImageSelection />
        )}
        {currentStep === WorkspaceCreationSteps.Properties && (
          <WorkspaceCreationPropertiesSelection />
        )}
      </PageSection>
      <PageSection isFilled={false} stickyOnBreakpoint={{ default: 'bottom' }}>
        <Flex>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={previousStep}
              isDisabled={currentStep === 0}
            >
              Previous
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={nextStep}
              isDisabled={currentStep === Object.keys(WorkspaceCreationSteps).length / 2 - 1}
            >
              Next
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="link" isInline onClick={cancel}>
              Cancel
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
    </>
  );
};

export { WorkspaceCreation };
