import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Content,
  Flex,
  FlexItem,
  PageGroup,
  PageSection,
  ProgressStep,
  ProgressStepper,
  Stack,
} from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons';
import { useNavigate } from 'react-router-dom';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { WorkspaceKindCreate } from '~/shared/api/backendApiTypes';
import { WorkspaceKindCreationMethod } from './method/WorkspaceKindCreationMethod';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';
import { WorkspaceKindFormImage } from './image/WorkspaceKindFormImage';

enum WorkspaceKindFormSteps {
  CreationMethod,
  Properties,
  Images,
  PodConfig,
  PodTemplate,
}
const stepDescriptions: { [key in WorkspaceKindFormSteps]?: string } = {
  [WorkspaceKindFormSteps.CreationMethod]: 'Select a method to create a Workspace Kind.',
  [WorkspaceKindFormSteps.Properties]: 'Configure properties for your Workspace Kind.',
  [WorkspaceKindFormSteps.Images]:
    'Configure images for your Workspace Kind and select a default image.',
  [WorkspaceKindFormSteps.PodConfig]:
    'Manage pod configurations for your Workspace Kind and select a default configuration.',
  [WorkspaceKindFormSteps.PodTemplate]: 'TODO',
};

export enum WorkspaceKindCreationMethodTypes {
  Manual,
  FileUpload,
}

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useNavigate();
  const [methodSelected, setMethodSelected] = useState<WorkspaceKindCreationMethodTypes>(
    WorkspaceKindCreationMethodTypes.FileUpload,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentStep, setCurrentStep] = useState(WorkspaceKindFormSteps.CreationMethod);

  const [data, setData, resetData] = useGenericObjectState<WorkspaceKindCreate>({
    properties: {
      displayName: '',
      description: '',
      deprecated: false,
      deprecationMessage: '',
      hidden: false,
      icon: { url: '' },
      logo: { url: '' },
    },
    imageConfig: {
      default: '',
      values: [],
    },
  });

  const getStepVariant = useCallback(
    (step: WorkspaceKindFormSteps) => {
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

  const canGoToPreviousStep = useMemo(() => currentStep > 0, [currentStep]);

  const canGoToNextStep = useMemo(
    () => currentStep < Object.keys(WorkspaceKindFormSteps).length / 2 - 1,
    [currentStep],
  );

  const canSubmit = useMemo(
    () => !isSubmitting && !canGoToNextStep,
    [canGoToNextStep, isSubmitting],
  );

  const handleCreate = useCallback(() => {
    // TODO: Complete handleCreate with API call to create a new WS kind
    if (!Object.keys(data).length) {
      return;
    }
    setIsSubmitting(true);
  }, [data]);

  const cancel = useCallback(() => {
    navigate('/workspacekinds');
  }, [navigate]);

  return (
    <>
      <PageGroup isFilled={false} stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection>
          <Stack hasGutter>
            <Flex direction={{ default: 'column' }} rowGap={{ default: 'rowGapXl' }}>
              <FlexItem>
                <Content>
                  <h1>Create workspace kind</h1>
                  <p>{stepDescriptions[currentStep]}</p>
                </Content>
              </FlexItem>
              <FlexItem>
                <ProgressStepper aria-label="Workspace creation stepper">
                  <ProgressStep
                    variant={getStepVariant(WorkspaceKindFormSteps.CreationMethod)}
                    id="method-step"
                    isCurrent={currentStep === WorkspaceKindFormSteps.CreationMethod}
                    titleId="method-step-title"
                    aria-label="Method selection step"
                  >
                    Method
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceKindFormSteps.Properties)}
                    id="properties-step"
                    isCurrent={currentStep === WorkspaceKindFormSteps.Properties}
                    titleId="properties-step-title"
                    aria-label="Properties selection step"
                  >
                    Properties
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceKindFormSteps.Images)}
                    id="images-step"
                    isCurrent={currentStep === WorkspaceKindFormSteps.Images}
                    titleId="images-step-title"
                    aria-label="Images step"
                  >
                    Images
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceKindFormSteps.PodConfig)}
                    id="pod-config-step"
                    isCurrent={currentStep === WorkspaceKindFormSteps.PodConfig}
                    titleId="pod-config-step-title"
                    aria-label="Pod configuration step"
                  >
                    Pod Configurations
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceKindFormSteps.PodTemplate)}
                    id="pod-template-step"
                    isCurrent={currentStep === WorkspaceKindFormSteps.PodTemplate}
                    titleId="pod-template-step-title"
                    aria-label="Pod template step"
                  >
                    Pod Template
                  </ProgressStep>
                </ProgressStepper>
              </FlexItem>
            </Flex>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {currentStep === WorkspaceKindFormSteps.CreationMethod && (
          <WorkspaceKindCreationMethod
            method={methodSelected}
            onMethodSelect={(methodType: WorkspaceKindCreationMethodTypes) =>
              setMethodSelected(methodType)
            }
            setData={setData}
            resetData={resetData}
          />
        )}
        {currentStep === WorkspaceKindFormSteps.Properties && (
          <WorkspaceKindFormProperties
            properties={data.properties}
            updateField={(properties) => setData('properties', properties)}
          />
        )}
        {currentStep === WorkspaceKindFormSteps.Images && (
          <WorkspaceKindFormImage
            imageConfig={data.imageConfig}
            updateImageConfig={(imageInput) => {
              setData('imageConfig', imageInput);
            }}
          />
        )}
        {currentStep === WorkspaceKindFormSteps.PodConfig && <>{/* TODO: Implement step */}</>}
        {currentStep === WorkspaceKindFormSteps.PodTemplate && <>{/* TODO: Implement step */}</>}
      </PageSection>
      <PageSection isFilled={false} stickyOnBreakpoint={{ default: 'bottom' }}>
        <Flex>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={previousStep}
              isDisabled={!canGoToPreviousStep}
            >
              Previous
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={nextStep}
              isDisabled={!canGoToNextStep}
            >
              Next
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={handleCreate}
              isDisabled={!canSubmit}
            >
              Create
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
