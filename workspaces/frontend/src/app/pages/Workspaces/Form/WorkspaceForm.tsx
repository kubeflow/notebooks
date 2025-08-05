import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import {
  ProgressStep,
  ProgressStepper,
} from '@patternfly/react-core/dist/esm/components/ProgressStepper';
import { Stack } from '@patternfly/react-core/dist/esm/layouts/Stack';
import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
} from '@patternfly/react-core/dist/esm/components/Drawer';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceFormImageSelection } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageSelection';
import { WorkspaceFormKindSelection } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindSelection';
import { WorkspaceFormPodConfigSelection } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigSelection';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormData } from '~/app/types';
import useWorkspaceFormData from '~/app/hooks/useWorkspaceFormData';
import { useTypedNavigate } from '~/app/routerHelper';
import {
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
  WorkspacekindsWorkspaceKind,
  WorkspacesWorkspaceCreate,
} from '~/generated/data-contracts';
import { useWorkspaceFormLocationData } from '~/app/hooks/useWorkspaceFormLocationData';
import { WorkspaceFormKindDetails } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindDetails';
import { WorkspaceFormImageDetails } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageDetails';
import { WorkspaceFormPodConfigDetails } from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigDetails';

enum WorkspaceFormSteps {
  KindSelection,
  ImageSelection,
  PodConfigSelection,
  Properties,
}

const stepDescriptions: { [key in WorkspaceFormSteps]?: string } = {
  [WorkspaceFormSteps.KindSelection]:
    'A workspace kind is a template for creating a workspace, which is an isolated area where you can work with models in your preferred IDE, such as Jupyter Notebook.',
  [WorkspaceFormSteps.ImageSelection]:
    'Select a workspace image and image version to use for the workspace. A workspace image is a container image that contains the software and dependencies needed to run a workspace.',
  [WorkspaceFormSteps.PodConfigSelection]:
    'Select a pod config to use for the workspace. A pod config is a configuration that defines the resources and settings for a workspace.',
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(WorkspaceFormSteps.KindSelection);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  const [data, setData, resetData, replaceData] =
    useGenericObjectState<WorkspaceFormData>(initialFormData);

  useEffect(() => {
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

  const isStepValid = useCallback(
    (step: WorkspaceFormSteps) => {
      switch (step) {
        case WorkspaceFormSteps.KindSelection:
          return !!data.kind;
        case WorkspaceFormSteps.ImageSelection:
          return !!data.image;
        case WorkspaceFormSteps.PodConfigSelection:
          return !!data.podConfig;
        case WorkspaceFormSteps.Properties:
          return !!data.properties.workspaceName.trim();
        default:
          return false;
      }
    },
    [data.kind, data.image, data.podConfig, data.properties.workspaceName],
  );

  const showDrawer = useCallback(
    (step: WorkspaceFormSteps) =>
      // Only show drawer for steps that have drawer content
      step !== WorkspaceFormSteps.Properties && isStepValid(step),
    [isStepValid],
  );

  const previousStep = useCallback(() => {
    const newStep = currentStep - 1;
    setCurrentStep(newStep);
    setDrawerExpanded(showDrawer(newStep));
  }, [currentStep, showDrawer]);

  const nextStep = useCallback(() => {
    const newStep = currentStep + 1;
    setCurrentStep(newStep);
    setDrawerExpanded(showDrawer(newStep));
  }, [currentStep, showDrawer]);

  const canGoToPreviousStep = useMemo(() => currentStep > 0, [currentStep]);

  const isCurrentStepValid = useMemo(() => isStepValid(currentStep), [isStepValid, currentStep]);

  const canGoToNextStep = useMemo(
    () => currentStep < Object.keys(WorkspaceFormSteps).length / 2 - 1,
    [currentStep],
  );

  const canSubmit = useMemo(
    () => !isSubmitting && !canGoToNextStep && isCurrentStepValid,
    [canGoToNextStep, isSubmitting, isCurrentStepValid],
  );

  const handleSubmit = useCallback(async () => {
    // TODO: properly validate data before submitting
    if (!data.kind || !data.image || !data.podConfig) {
      return;
    }

    // TODO: Prepare WorkspaceUpdate data accordingly when BE supports it
    const submitData: WorkspacesWorkspaceCreate = {
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
        // TODO: call api to update workspace when implemented in backend
      } else {
        const workspaceEnvelope = await api.workspaces.createWorkspace(namespace, {
          data: submitData,
        });
        // TODO: alert user about success
        console.info('New workspace created:', JSON.stringify(workspaceEnvelope.data));
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

  const handleKindSelect = useCallback(
    (kind: WorkspacekindsWorkspaceKind | undefined) => {
      if (kind) {
        resetData();
        setData('kind', kind);
        setDrawerExpanded(true);
      }
    },
    [resetData, setData],
  );

  const handleImageSelect = useCallback(
    (image: WorkspacekindsImageConfigValue | undefined) => {
      if (image) {
        setData('image', image);
        setDrawerExpanded(true);
      }
    },
    [setData],
  );

  const handlePodConfigSelect = useCallback(
    (podConfig: WorkspacekindsPodConfigValue | undefined) => {
      if (podConfig) {
        setData('podConfig', podConfig);
        setDrawerExpanded(true);
      }
    },
    [setData],
  );

  const getDrawerContent = () => {
    switch (currentStep) {
      case WorkspaceFormSteps.KindSelection:
        return <WorkspaceFormKindDetails workspaceKind={data.kind} />;
      case WorkspaceFormSteps.ImageSelection:
        return <WorkspaceFormImageDetails workspaceImage={data.image} />;
      case WorkspaceFormSteps.PodConfigSelection:
        return <WorkspaceFormPodConfigDetails workspacePodConfig={data.podConfig} />;
      default:
        return null;
    }
  };

  const getDrawerTitle = () => {
    switch (currentStep) {
      case WorkspaceFormSteps.KindSelection:
        return 'Workspace Kind';
      case WorkspaceFormSteps.ImageSelection:
        return 'Image';
      case WorkspaceFormSteps.PodConfigSelection:
        return 'Pod Config';
      default:
        return '';
    }
  };

  if (initialFormDataError) {
    return <p>Error loading workspace data: {initialFormDataError.message}</p>; // TODO: UX for error state
  }

  if (!initialFormDataLoaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
  }

  const panelContent = (
    <DrawerPanelContent>
      <DrawerHead>
        <Title headingLevel="h1">{getDrawerTitle()}</Title>
        <DrawerActions>
          <DrawerCloseButton onClick={() => setDrawerExpanded(false)} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody className="workspace-form__drawer-panel-body">
        {getDrawerContent()}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  return (
    <Drawer isInline isExpanded={drawerExpanded}>
      <DrawerContent panelContent={panelContent}>
        <DrawerContentBody>
          <Flex
            direction={{ default: 'column' }}
            flexWrap={{ default: 'nowrap' }}
            style={{ height: '100%' }}
          >
            <FlexItem>
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
            </FlexItem>
            <FlexItem flex={{ default: 'flex_1' }}>
              <PageSection isFilled>
                {currentStep === WorkspaceFormSteps.KindSelection && (
                  <WorkspaceFormKindSelection
                    selectedKind={data.kind}
                    onSelect={handleKindSelect}
                  />
                )}
                {currentStep === WorkspaceFormSteps.ImageSelection && (
                  <WorkspaceFormImageSelection
                    selectedImage={data.image}
                    onSelect={handleImageSelect}
                    images={data.kind?.podTemplate.options.imageConfig.values ?? []}
                  />
                )}
                {currentStep === WorkspaceFormSteps.PodConfigSelection && (
                  <WorkspaceFormPodConfigSelection
                    selectedPodConfig={data.podConfig}
                    onSelect={handlePodConfigSelect}
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
            </FlexItem>
            <FlexItem>
              <PageSection>
                <Flex>
                  <FlexItem>
                    <Button
                      variant="secondary"
                      ouiaId="Secondary"
                      onClick={previousStep}
                      isDisabled={!canGoToPreviousStep}
                    >
                      Previous
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    {canGoToNextStep ? (
                      <Button
                        variant="primary"
                        ouiaId="Primary"
                        onClick={nextStep}
                        isDisabled={!isCurrentStepValid}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        ouiaId="Primary"
                        onClick={handleSubmit}
                        isDisabled={!canSubmit}
                      >
                        {mode === 'create' ? 'Create' : 'Save'}
                      </Button>
                    )}
                  </FlexItem>
                  <FlexItem>
                    <Button variant="link" isInline onClick={cancel}>
                      Cancel
                    </Button>
                  </FlexItem>
                </Flex>
              </PageSection>
            </FlexItem>
          </Flex>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};

export { WorkspaceForm };
