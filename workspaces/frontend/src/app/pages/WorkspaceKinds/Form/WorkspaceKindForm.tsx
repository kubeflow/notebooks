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
  StackItem,
} from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons';
import { useNavigate } from 'react-router-dom';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { WorkspaceKindCreateFormData } from '~/app/types';
import { WorkspaceKindCreationMethod } from './method/WorkspaceKindCreationMethod';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';

enum WorkspaceKindCreationSteps {
  CreationMethod,
  Properties,
  Images,
  PodConfig,
}

export enum WorkspaceKindCreationMethodTypes {
  Manual,
  FileUpload,
}

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useNavigate();
  const [methodSelected, setMethodSelected] = useState<WorkspaceKindCreationMethodTypes>(
    WorkspaceKindCreationMethodTypes.Manual,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentStep, setCurrentStep] = useState(WorkspaceKindCreationSteps.CreationMethod);

  const [data, setData, resetData] = useGenericObjectState<WorkspaceKindCreateFormData>({
    properties: {
      displayName: '',
      description: '',
      deprecated: false,
      deprecationMessage: '',
      hidden: false,
      icon: { url: '' },
      logo: { url: '' },
    },
  });

  const getStepVariant = useCallback(
    (step: WorkspaceKindCreationSteps) => {
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
    () => currentStep < Object.keys(WorkspaceKindCreationSteps).length / 2 - 1,
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
            <StackItem>
              <Flex>
                <Content>
                  <h1>Create workspace kind</h1>
                </Content>
              </Flex>
            </StackItem>
            <StackItem>
              <ProgressStepper aria-label="Workspace creation stepper">
                <ProgressStep
                  variant={getStepVariant(WorkspaceKindCreationSteps.CreationMethod)}
                  id="method-step"
                  icon={
                    getStepVariant(WorkspaceKindCreationSteps.CreationMethod) === 'success' ? (
                      <CheckIcon />
                    ) : (
                      1
                    )
                  }
                  titleId="method-step-title"
                  aria-label="Method selection step"
                >
                  Method
                </ProgressStep>
                <ProgressStep
                  variant={getStepVariant(WorkspaceKindCreationSteps.Properties)}
                  id="properties-step"
                  icon={
                    getStepVariant(WorkspaceKindCreationSteps.Properties) === 'success' ? (
                      <CheckIcon />
                    ) : (
                      2
                    )
                  }
                  titleId="properties-step-title"
                  aria-label="Properties selection step"
                >
                  Properties
                </ProgressStep>
              </ProgressStepper>
            </StackItem>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {currentStep === WorkspaceKindCreationSteps.CreationMethod && (
          <WorkspaceKindCreationMethod
            method={methodSelected}
            onMethodSelect={(methodType: WorkspaceKindCreationMethodTypes) =>
              setMethodSelected(methodType)
            }
            setData={setData}
            resetData={resetData}
          />
        )}
        {currentStep === WorkspaceKindCreationSteps.Properties && (
          <WorkspaceKindFormProperties
            properties={data.properties}
            updateField={(properties) => setData('properties', properties)}
          />
        )}
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
