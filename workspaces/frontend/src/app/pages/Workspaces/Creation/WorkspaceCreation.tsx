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
  StackItem,
} from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceCreationImageSelection } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageSelection';
import { WorkspaceCreationKindSelection } from '~/app/pages/Workspaces/Creation/kind/WorkspaceCreationKindSelection';
import { WorkspaceCreationPodConfigSelection } from '~/app/pages/Workspaces/Creation/podConfig/WorkspaceCreationPodConfigSelection';
import { WorkspaceCreationPropertiesSelection } from '~/app/pages/Workspaces/Creation/properties/WorkspaceCreationPropertiesSelection';
import { WorkspaceCreateFormData } from '~/app/types';
import { WorkspaceCreate } from '~/shared/api/backendApiTypes';

enum WorkspaceCreationSteps {
  KindSelection,
  ImageSelection,
  PodConfigSelection,
  Properties,
}

const WorkspaceCreation: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentStep, setCurrentStep] = useState(WorkspaceCreationSteps.KindSelection);

  const [data, setData, resetData] = useGenericObjectState<WorkspaceCreateFormData>({
    kind: undefined,
    image: undefined,
    podConfig: undefined,
    properties: {
      deferUpdates: false,
      homeDirectory: '',
      volumes: [],
      secrets: [],
      workspaceName: '',
    },
  });

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

  const canGoToPreviousStep = useMemo(() => currentStep > 0, [currentStep]);

  const canGoToNextStep = useMemo(
    () => currentStep < Object.keys(WorkspaceCreationSteps).length / 2 - 1,
    [currentStep],
  );

  const canSubmit = useMemo(
    () => !isSubmitting && !canGoToNextStep,
    [canGoToNextStep, isSubmitting],
  );

  const handleCreate = useCallback(() => {
    // TODO: properly validate data before submitting
    if (!data.kind || !data.image || !data.podConfig) {
      return;
    }

    const workspaceCreate: WorkspaceCreate = {
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

    api
      .createWorkspace({}, selectedNamespace, { data: workspaceCreate })
      .then((newWorkspace) => {
        // TODO: alert user about success
        console.info('New workspace created:', JSON.stringify(newWorkspace));
        navigate('/workspaces');
      })
      .catch((err) => {
        // TODO: alert user about error
        console.error('Error creating workspace:', err);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [api, data, navigate, selectedNamespace]);

  const cancel = useCallback(() => {
    navigate('/workspaces');
  }, [navigate]);

  return (
    <>
      <PageGroup isFilled={false} stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection>
          <Stack hasGutter>
            <StackItem>
              <Flex>
                <Content>
                  <h1>Create workspace</h1>
                </Content>
              </Flex>
            </StackItem>
            <StackItem>
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
                    getStepVariant(WorkspaceCreationSteps.Properties) === 'success' ? (
                      <CheckIcon />
                    ) : (
                      4
                    )
                  }
                  titleId="properties-step-title"
                  aria-label="Properties step"
                >
                  Properties
                </ProgressStep>
              </ProgressStepper>
            </StackItem>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {currentStep === WorkspaceCreationSteps.KindSelection && (
          <WorkspaceCreationKindSelection
            selectedKind={data.kind}
            onSelect={(kind) => {
              resetData();
              setData('kind', kind);
            }}
          />
        )}
        {currentStep === WorkspaceCreationSteps.ImageSelection && (
          <WorkspaceCreationImageSelection
            selectedImage={data.image}
            onSelect={(image) => setData('image', image)}
            images={data.kind?.podTemplate.options.imageConfig.values ?? []}
          />
        )}
        {currentStep === WorkspaceCreationSteps.PodConfigSelection && (
          <WorkspaceCreationPodConfigSelection
            selectedPodConfig={data.podConfig}
            onSelect={(podConfig) => setData('podConfig', podConfig)}
            podConfigs={data.kind?.podTemplate.options.podConfig.values ?? []}
          />
        )}
        {currentStep === WorkspaceCreationSteps.Properties && (
          <WorkspaceCreationPropertiesSelection
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

export { WorkspaceCreation };
