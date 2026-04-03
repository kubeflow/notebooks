import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import {
  ProgressStep,
  ProgressStepper,
} from '@patternfly/react-core/dist/esm/components/ProgressStepper';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
} from '@patternfly/react-core/dist/esm/components/Drawer';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { useNotification } from 'mod-arch-core';
import useGenericObjectState from 'mod-arch-core/dist/utilities/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import {
  WorkspaceFormImageSelection,
  ImageSelectionFilterHandle,
} from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageSelection';
import { WorkspaceFormKindSelection } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindSelection';
import {
  WorkspaceFormPodConfigSelection,
  PodConfigSelectionFilterHandle,
} from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigSelection';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormData } from '~/app/types';
import useWorkspaceFormData from '~/app/hooks/useWorkspaceFormData';
import { useTypedNavigate } from '~/app/routerHelper';
import {
  ApiErrorEnvelope,
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
  WorkspacekindsWorkspaceKind,
} from '~/generated/data-contracts';
import { extractErrorMessage } from '~/shared/api/apiUtils';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import { useWorkspaceFormLocationData } from '~/app/hooks/useWorkspaceFormLocationData';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { submitFormData } from '~/app/pages/Workspaces/Form/submitHelper';
import { WorkspaceFormSummaryPanel } from '~/app/pages/Workspaces/Form/WorkspaceFormSummaryPanel';

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
  const notification = useNotification();
  const { api } = useNotebookAPI();

  const { mode, namespace, workspaceName, workspaceKindName } = useWorkspaceFormLocationData();
  const [initialFormData, initialFormDataLoaded, initialFormDataError] = useWorkspaceFormData({
    namespace,
    workspaceName,
    workspaceKindName,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(WorkspaceFormSteps.KindSelection);
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

  const [data, setData, resetData, replaceData] =
    useGenericObjectState<WorkspaceFormData>(initialFormData);

  // Store original values for edit mode diff view
  const [originalData, setOriginalData] = useState<WorkspaceFormData | undefined>(undefined);

  // Refs for filter control
  const imageFilterControlRef = useRef<ImageSelectionFilterHandle>(null);
  const podConfigFilterControlRef = useRef<PodConfigSelectionFilterHandle>(null);

  useEffect(() => {
    if (!initialFormDataLoaded || mode === 'create') {
      return;
    }
    replaceData(initialFormData);
    // Store original values for diff comparison
    setOriginalData(initialFormData);
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
          return !!data.imageConfig;
        case WorkspaceFormSteps.PodConfigSelection:
          return !!data.podConfig;
        case WorkspaceFormSteps.Properties:
          return !!data.properties.workspaceName.trim() && !!data.properties.homeVolume;
        default:
          return false;
      }
    },
    [
      data.kind,
      data.imageConfig,
      data.podConfig,
      data.properties.workspaceName,
      data.properties.homeVolume,
    ],
  );

  const previousStep = useCallback(() => {
    const newStep = currentStep - 1;
    setCurrentStep(newStep);
  }, [currentStep]);

  const nextStep = useCallback(() => {
    const newStep = currentStep + 1;
    setCurrentStep(newStep);
  }, [currentStep]);

  const navigateToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const canGoToPreviousStep = useMemo(() => currentStep > 0, [currentStep]);

  const isCurrentStepValid = useMemo(() => isStepValid(currentStep), [isStepValid, currentStep]);

  const selectedImage = useMemo(
    () =>
      data.kind?.podTemplate.options.imageConfig.values.find(
        (image) => image.id === data.imageConfig,
      ),
    [data.kind, data.imageConfig],
  );

  const selectedPodConfig = useMemo(
    () =>
      data.kind?.podTemplate.options.podConfig.values.find(
        (podConfig) => podConfig.id === data.podConfig,
      ),
    [data.kind, data.podConfig],
  );

  const canGoToNextStep = useMemo(
    () => currentStep < Object.keys(WorkspaceFormSteps).length / 2 - 1,
    [currentStep],
  );

  const canSubmit = useMemo(
    () => !isSubmitting && !canGoToNextStep && isCurrentStepValid,
    [canGoToNextStep, isSubmitting, isCurrentStepValid],
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Strip the UI-only `isAttached` field from homeVolume, volumes, and secrets before submitting
      const { homeVolume } = data.properties;
      const preparedData: WorkspaceFormData = {
        ...data,
        properties: {
          ...data.properties,
          homeVolume: homeVolume
            ? {
                pvcName: homeVolume.pvcName,
                mountPath: homeVolume.mountPath,
                readOnly: homeVolume.readOnly,
              }
            : undefined,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          secrets: data.properties.secrets.map(({ isAttached: _, ...rest }) => rest),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          volumes: data.properties.volumes.map(({ isAttached: _, ...rest }) => rest),
        },
      };
      await submitFormData({ mode, data: preparedData, api, namespace });
      navigate('workspaces');
      notification.success(
        `Workspace '${data.properties.workspaceName}' ${mode === 'create' ? 'created' : 'updated'} successfully`,
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [data, mode, navigate, api, namespace, notification]);

  const cancel = useCallback(() => {
    navigate('workspaces');
  }, [navigate]);

  const handleKindSelect = useCallback(
    (kind: WorkspacekindsWorkspaceKind | undefined) => {
      if (!kind) {
        return;
      }
      if (mode === 'create') {
        resetData();
        setData('kind', kind);

        const defaultImageId = kind.podTemplate.options.imageConfig.default;
        const defaultPodConfigId = kind.podTemplate.options.podConfig.default;

        if (defaultImageId) {
          setData('imageConfig', defaultImageId);
        }
        if (defaultPodConfigId) {
          setData('podConfig', defaultPodConfigId);
        }
      }
    },
    [mode, resetData, setData],
  );

  const handleImageSelect = useCallback(
    (image: WorkspacekindsImageConfigValue | undefined) => {
      if (image) {
        // Clear filters if the selected image is hidden or redirected
        if (image.hidden || image.redirect !== undefined) {
          imageFilterControlRef.current?.adaptFiltersForImage(image);
        }
        setData('imageConfig', image.id);
      } else {
        setData('imageConfig', undefined);
      }
    },
    [setData],
  );

  const handlePodConfigSelect = useCallback(
    (podConfig: WorkspacekindsPodConfigValue | undefined) => {
      if (podConfig) {
        // Clear filters if the selected pod config is hidden or redirected
        if (podConfig.hidden || podConfig.redirect !== undefined) {
          podConfigFilterControlRef.current?.adaptFiltersForPodConfig(podConfig);
        }
        setData('podConfig', podConfig.id);
      } else {
        setData('podConfig', undefined);
      }
    },
    [setData],
  );

  // Get original values for edit mode diff
  const originalImage = useMemo(
    () =>
      originalData?.kind?.podTemplate.options.imageConfig.values.find(
        (image) => image.id === originalData.imageConfig,
      ),
    [originalData],
  );

  const originalPodConfig = useMemo(
    () =>
      originalData?.kind?.podTemplate.options.podConfig.values.find(
        (podConfig) => podConfig.id === originalData.podConfig,
      ),
    [originalData],
  );

  if (initialFormDataError) {
    return <LoadError title="Failed to load workspace data" error={initialFormDataError} />;
  }

  if (!initialFormDataLoaded) {
    return <LoadingSpinner />;
  }

  const panelContent = (
    <DrawerPanelContent>
      <DrawerHead>
        <Title headingLevel="h1">Summary</Title>
      </DrawerHead>
      <DrawerPanelBody className="workspace-form__drawer-panel-body">
        <WorkspaceFormSummaryPanel
          mode={mode}
          selectedKind={data.kind}
          selectedImage={selectedImage}
          selectedPodConfig={selectedPodConfig}
          properties={data.properties}
          currentStep={currentStep}
          onNavigateToStep={navigateToStep}
          onSelectImage={handleImageSelect}
          onSelectPodConfig={handlePodConfigSelect}
          originalKind={originalData?.kind}
          originalImage={originalImage}
          originalPodConfig={originalPodConfig}
          originalProperties={originalData?.properties}
        />
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  return (
    <Drawer isInline isExpanded>
      <DrawerContent panelContent={panelContent}>
        <DrawerContentBody>
          <Flex
            direction={{ default: 'column' }}
            flexWrap={{ default: 'nowrap' }}
            className="workspace-form__full-height"
          >
            <FlexItem>
              <PageSection>
                <Stack hasGutter>
                  <Flex direction={{ default: 'column' }} rowGap={{ default: 'rowGapXl' }}>
                    <FlexItem>
                      <Content>
                        <h1 data-testid="workspace-form-title">{`${mode === 'create' ? 'Create' : 'Edit'} workspace`}</h1>
                        <p>{stepDescriptions[currentStep]}</p>
                      </Content>
                    </FlexItem>
                    <FlexItem>
                      <ProgressStepper
                        aria-label="Workspace form stepper"
                        data-testid="workspace-form-stepper"
                      >
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
              <PageSection className="workspace-form__full-height" isFilled>
                <Stack hasGutter>
                  {error && (
                    <StackItem>
                      <ErrorAlert
                        title={`Failed to ${mode === 'create' ? 'create' : 'edit'} workspace`}
                        content={error}
                        testId="workspace-form-error"
                      />
                    </StackItem>
                  )}
                  <StackItem isFilled>
                    {currentStep === WorkspaceFormSteps.KindSelection && (
                      <WorkspaceFormKindSelection
                        mode={mode}
                        namespace={namespace}
                        selectedKind={data.kind}
                        onSelect={handleKindSelect}
                      />
                    )}
                    {currentStep === WorkspaceFormSteps.ImageSelection && (
                      <WorkspaceFormImageSelection
                        selectedImage={selectedImage}
                        onSelect={handleImageSelect}
                        images={data.kind?.podTemplate.options.imageConfig.values ?? []}
                        defaultImageId={data.kind?.podTemplate.options.imageConfig.default}
                        filterControlRef={imageFilterControlRef}
                      />
                    )}
                    {currentStep === WorkspaceFormSteps.PodConfigSelection && (
                      <WorkspaceFormPodConfigSelection
                        selectedPodConfig={selectedPodConfig}
                        onSelect={handlePodConfigSelect}
                        podConfigs={data.kind?.podTemplate.options.podConfig.values ?? []}
                        defaultPodConfigId={data.kind?.podTemplate.options.podConfig.default}
                        filterControlRef={podConfigFilterControlRef}
                      />
                    )}
                    {currentStep === WorkspaceFormSteps.Properties && (
                      <WorkspaceFormPropertiesSelection
                        mode={mode}
                        selectedProperties={data.properties}
                        onSelect={(properties) => setData('properties', properties)}
                        homeVolumeMountPath={data.kind?.podTemplate.volumeMounts.home}
                      />
                    )}
                  </StackItem>
                </Stack>
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
                      data-testid="previous-button"
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
                        data-testid="next-button"
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        ouiaId="Primary"
                        onClick={handleSubmit}
                        isDisabled={!canSubmit}
                        data-testid="submit-button"
                      >
                        {mode === 'create' ? 'Create' : 'Save'}
                      </Button>
                    )}
                  </FlexItem>
                  <FlexItem>
                    <Button variant="link" onClick={cancel} data-testid="cancel-button">
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
