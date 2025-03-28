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
import { CheckIcon } from '@patternfly/react-icons';
import { WorkspaceCreationImageSelection } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageSelection';
import { WorkspaceCreationKindSelection } from '~/app/pages/Workspaces/Creation/kind/WorkspaceCreationKindSelection';
import { WorkspaceCreationPropertiesSelection } from '~/app/pages/Workspaces/Creation/WorkspaceCreationPropertiesSelection';
import { WorkspaceCreationPodConfigSelection } from '~/app/pages/Workspaces/Creation/podConfig/WorkspaceCreationPodConfigSelection';
import { WorkspaceImage, WorkspaceKind } from '~/shared/types';

enum WorkspaceCreationSteps {
  KindSelection,
  ImageSelection,
  PodConfigSelection,
  Properties,
}

const WorkspaceCreation: React.FunctionComponent = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(WorkspaceCreationSteps.KindSelection);
  const [selectedKind, setSelectedKind] = useState<WorkspaceKind>();
  const [selectedImage, setSelectedImage] = useState<WorkspaceImage>();

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

  const onSelectWorkspaceKind = useCallback((newWorkspaceKind: WorkspaceKind) => {
    setSelectedKind(newWorkspaceKind);
    setSelectedImage(undefined);
  }, []);

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
              icon={
                getStepVariant(WorkspaceCreationSteps.KindSelection) === 'success' ? (
                  <CheckIcon />
                ) : (
                  1
                )
              }
              titleId="kind-selection-step-title"
              aria-label="Kind selection step"
            >
              Workspace Kind
            </ProgressStep>
            <ProgressStep
              variant={getStepVariant(WorkspaceCreationSteps.ImageSelection)}
              isCurrent
              id="image-selection-step"
              icon={
                getStepVariant(WorkspaceCreationSteps.ImageSelection) === 'success' ? (
                  <CheckIcon />
                ) : (
                  2
                )
              }
              titleId="image-selection-step-title"
              aria-label="Image selection step"
            >
              Image
            </ProgressStep>
            <ProgressStep
              variant={getStepVariant(WorkspaceCreationSteps.PodConfigSelection)}
              isCurrent
              id="pod-config-selection-step"
              icon={
                getStepVariant(WorkspaceCreationSteps.PodConfigSelection) === 'success' ? (
                  <CheckIcon />
                ) : (
                  3
                )
              }
              titleId="pod-config-selection-step-title"
              aria-label="Pod config selection step"
            >
              Pod Config
            </ProgressStep>
            <ProgressStep
              variant={getStepVariant(WorkspaceCreationSteps.Properties)}
              id="properties-step"
              icon={
                getStepVariant(WorkspaceCreationSteps.Properties) === 'success' ? <CheckIcon /> : 4
              }
              titleId="properties-step-title"
              aria-label="Properties step"
            >
              Properties
            </ProgressStep>
          </ProgressStepper>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {currentStep === WorkspaceCreationSteps.KindSelection && (
          <WorkspaceCreationKindSelection
            selectedKind={selectedKind}
            onSelect={onSelectWorkspaceKind}
          />
        )}
        {currentStep === WorkspaceCreationSteps.ImageSelection && (
          <WorkspaceCreationImageSelection
            selectedImage={selectedImage}
            images={selectedKind?.podTemplate.options.imageConfig.values ?? []}
            onSelect={setSelectedImage}
          />
        )}
        {currentStep === WorkspaceCreationSteps.PodConfigSelection && (
          <WorkspaceCreationPodConfigSelection />
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
