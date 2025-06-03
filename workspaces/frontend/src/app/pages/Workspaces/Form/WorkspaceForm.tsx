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
  Stack,
} from '@patternfly/react-core';
import { useCallback, useMemo, useState } from 'react';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceFormImageSelection } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageSelection';
import { WorkspaceFormKindSelection } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindSelection';
import { WorkspaceFormPodConfigSelection } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigSelection';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormData } from '~/app/types';
import { WorkspaceCreate } from '~/shared/api/backendApiTypes';
import useWorkspaceFormData from '~/app/hooks/useWorkspaceFormData';
import { useTypedNavigate } from '~/app/routerHelper';
import { useWorkspaceFormLocationData } from '~/app/hooks/useWorkspaceFormLocationData';

enum WorkspaceFormSteps {
  KindSelection,
  ImageSelection,
  PodConfigSelection,
  Properties,
}

const stepDescriptions: { [key in WorkspaceFormSteps]?: string } = {
  [WorkspaceFormSteps.KindSelection]: 'Select a workspace kind to use for the workspace.',
  [WorkspaceFormSteps.ImageSelection]:
    'Select a workspace image and image version to use for the workspace.',
  [WorkspaceFormSteps.PodConfigSelection]: 'Select a pod config to use for the workspace.',
  [WorkspaceFormSteps.Properties]: 'Configure properties for your workspace.',
};

const WorkspaceForm: React.FC = () => {
  const navigate = useTypedNavigate();
  const { api } = useNotebookAPI();

  const { mode, namespace, workspaceName } = useWorkspaceFormLocationData();
  const [initialFormData, initialFormDataLoaded, initialFormDataError] = useWorkspaceFormData({
    namespace,
    workspaceName,
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentStep, setCurrentStep] = useState(WorkspaceFormSteps.KindSelection);

  const [data, setData, resetData, replaceData] =
    useGenericObjectState<WorkspaceFormData>(initialFormData);

  React.useEffect(() => {
    if (!initialFormDataLoaded || mode === 'create') {
      return;
    }
    replaceData(initialFormData);
  }, [initialFormData, initialFormDataLoaded, mode, replaceData]);

  const getStepVariant = useCallback(
    (step: WorkspaceFormSteps) => {
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
    () => currentStep < Object.keys(WorkspaceFormSteps).length / 2 - 1,
    [currentStep],
  );

  const canSubmit = useMemo(
    () => !isSubmitting && !canGoToNextStep,
    [canGoToNextStep, isSubmitting],
  );

  const handleSubmit = useCallback(async () => {
    // TODO: properly validate data before submitting
    if (!data.kind || !data.image || !data.podConfig) {
      return;
    }

    // TODO: Prepare WorkspaceUpdate data accordingly when BE supports it
    const submitData: WorkspaceCreate = {
      name: data.properties.workspaceName,
      kind: data.kind.name,
      deferUpdates: data.properties.deferUpdates,
      paused: false,
      podTemplate: {
        podMetadata: {
          labels: {},
          annotations: {},
        },
        options: {
          imageConfig: data.image.id,
          podConfig: data.podConfig.id,
        },
        volumes: {
          home: data.properties.homeDirectory,
          data: data.properties.volumes,
          secrets: data.properties.secrets,
        },
      },
    };

    setIsSubmitting(true);

    try {
      if (mode === 'edit') {
        const updateWorkspace = await api.updateWorkspace({}, submitData.name, namespace, {
          data: submitData,
        });
        // TODO: alert user about success
        console.info('Workspace updated:', JSON.stringify(updateWorkspace));
      } else {
        const newWorkspace = await api.createWorkspace({}, namespace, { data: submitData });
        // TODO: alert user about success
        console.info('New workspace created:', JSON.stringify(newWorkspace));
      }

      navigate('workspaces');
    } catch (err) {
      // TODO: alert user about error
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} workspace: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [data, mode, navigate, api, namespace]);

  const cancel = useCallback(() => {
    navigate('workspaces');
  }, [navigate]);

  if (initialFormDataError) {
    return <p>Error loading workspace data: {initialFormDataError.message}</p>; // TODO: UX for error state
  }

  if (!initialFormDataLoaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
  }

  return (
    <>
      <PageGroup isFilled={false} stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection>
          <Stack hasGutter>
            <Flex direction={{ default: 'column' }} rowGap={{ default: 'rowGapXl' }}>
              <FlexItem>
                <Content>
                  <h1>{`${mode === 'create' ? 'Create' : 'Edit'} workspace`}</h1>
                  <p>{stepDescriptions[currentStep]}</p>
                </Content>
              </FlexItem>
              <FlexItem>
                <ProgressStepper aria-label="Workspace form stepper">
                  <ProgressStep
                    variant={getStepVariant(WorkspaceFormSteps.KindSelection)}
                    isCurrent={currentStep === WorkspaceFormSteps.KindSelection}
                    id="kind-selection-step"
                    titleId="kind-selection-step-title"
                    aria-label="Kind selection step"
                  >
                    Workspace Kind
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceFormSteps.ImageSelection)}
                    isCurrent={currentStep === WorkspaceFormSteps.ImageSelection}
                    id="image-selection-step"
                    titleId="image-selection-step-title"
                    aria-label="Image selection step"
                  >
                    Image
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceFormSteps.PodConfigSelection)}
                    isCurrent={currentStep === WorkspaceFormSteps.PodConfigSelection}
                    id="pod-config-selection-step"
                    titleId="pod-config-selection-step-title"
                    aria-label="Pod config selection step"
                  >
                    Pod Config
                  </ProgressStep>
                  <ProgressStep
                    variant={getStepVariant(WorkspaceFormSteps.Properties)}
                    isCurrent={currentStep === WorkspaceFormSteps.Properties}
                    id="properties-step"
                    titleId="properties-step-title"
                    aria-label="Properties step"
                  >
                    Properties
                  </ProgressStep>
                </ProgressStepper>
              </FlexItem>
            </Flex>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {currentStep === WorkspaceFormSteps.KindSelection && (
          <WorkspaceFormKindSelection
            selectedKind={data.kind}
            onSelect={(kind) => {
              resetData();
              setData('kind', kind);
            }}
          />
        )}
        {currentStep === WorkspaceFormSteps.ImageSelection && (
          <WorkspaceFormImageSelection
            selectedImage={data.image}
            onSelect={(image) => setData('image', image)}
            images={data.kind?.podTemplate.options.imageConfig.values ?? []}
          />
        )}
        {currentStep === WorkspaceFormSteps.PodConfigSelection && (
          <WorkspaceFormPodConfigSelection
            selectedPodConfig={data.podConfig}
            onSelect={(podConfig) => setData('podConfig', podConfig)}
            podConfigs={data.kind?.podTemplate.options.podConfig.values ?? []}
          />
        )}
        {currentStep === WorkspaceFormSteps.Properties && (
          <WorkspaceFormPropertiesSelection
            selectedProperties={data.properties}
            onSelect={(properties) => setData('properties', properties)}
            selectedImage={data.image}
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
              onClick={handleSubmit}
              isDisabled={!canSubmit}
            >
              {mode === 'create' ? 'Create' : 'Save'}
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

export { WorkspaceForm };
