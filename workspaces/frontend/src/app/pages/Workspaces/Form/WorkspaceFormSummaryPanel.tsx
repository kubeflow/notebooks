import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { SummaryRedirectIcon } from '~/app/pages/Workspaces/Form/SummaryRedirectIcon';
import { SummaryDiffSection } from '~/app/pages/Workspaces/Form/SummaryDiffSection';
import { SummaryContentSection } from '~/app/pages/Workspaces/Form/SummaryContentSection';
import { SummaryPropertiesSection } from '~/app/pages/Workspaces/Form/SummaryPropertiesSection';
import { normalizeLabels } from '~/app/pages/Workspaces/Form/summaryHelpers';
import {
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
  WorkspacekindsWorkspaceKind,
  WorkspacekindsOptionLabel,
  WorkspacekindsRedirectMessageLevel,
} from '~/generated/data-contracts';
import { WorkspaceFormMode, WorkspaceFormProperties } from '~/app/types';

interface WorkspaceFormSummaryPanelProps {
  mode: WorkspaceFormMode;
  selectedKind: WorkspacekindsWorkspaceKind | undefined;
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  selectedPodConfig: WorkspacekindsPodConfigValue | undefined;
  properties: WorkspaceFormProperties;
  currentStep: number;
  onNavigateToStep: (step: number) => void;
  /** Handlers to switch selected options when clicking redirect target */
  onSelectImage: (image: WorkspacekindsImageConfigValue) => void;
  onSelectPodConfig: (podConfig: WorkspacekindsPodConfigValue) => void;
  /** For edit mode: original values to show diff */
  originalKind?: WorkspacekindsWorkspaceKind;
  originalImage?: WorkspacekindsImageConfigValue;
  originalPodConfig?: WorkspacekindsPodConfigValue;
  originalProperties?: WorkspaceFormProperties;
}

enum SummaryStep {
  KindSelection = 0,
  ImageSelection = 1,
  PodConfigSelection = 2,
  Properties = 3,
}

export const WorkspaceFormSummaryPanel: React.FC<WorkspaceFormSummaryPanelProps> = ({
  mode,
  selectedKind,
  selectedImage,
  selectedPodConfig,
  properties,
  currentStep,
  onNavigateToStep,
  onSelectImage,
  onSelectPodConfig,
  originalKind,
  originalImage,
  originalPodConfig,
  originalProperties,
}) => {
  const isEditMode = mode === 'update';
  const showDiff = Boolean(isEditMode && (originalKind || originalImage || originalPodConfig));

  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [pinnedPopoverId, setPinnedPopoverId] = useState<string | null>(null);

  const getMessageLevelColor = useCallback(
    (level?: WorkspacekindsRedirectMessageLevel): 'blue' | 'orange' | 'red' => {
      switch (level) {
        case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo:
          return 'blue';
        case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning:
          return 'orange';
        case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelDanger:
          return 'red';
        default:
          return 'blue';
      }
    },
    [],
  );

  const getMessageLevelText = useCallback((level?: WorkspacekindsRedirectMessageLevel): string => {
    switch (level) {
      case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo:
        return 'Info';
      case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning:
        return 'Warning';
      case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelDanger:
        return 'Danger';
      default:
        return 'Info';
    }
  }, []);

  const buildRedirectPopoverContent = useCallback(
    (args: {
      displayName: string;
      targetDisplayName: string;
      redirect: {
        to: string;
        message?: {
          level: WorkspacekindsRedirectMessageLevel;
          text: string;
        };
      };
      onClickTarget: () => void;
    }): React.ReactNode => {
      const { displayName, targetDisplayName, redirect, onClickTarget } = args;

      return (
        <Stack hasGutter>
          <StackItem>
            <Stack hasGutter>
              <StackItem>
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  {redirect.message && (
                    <FlexItem>
                      <Label color={getMessageLevelColor(redirect.message.level)} isCompact>
                        {getMessageLevelText(redirect.message.level)}
                      </Label>
                    </FlexItem>
                  )}
                  <FlexItem>
                    <strong>
                      {displayName} → {targetDisplayName}
                    </strong>
                  </FlexItem>
                </Flex>
              </StackItem>
              {redirect.message?.text && <StackItem>{redirect.message.text}</StackItem>}
              <StackItem>
                <Button
                  variant="link"
                  isInline
                  onClick={() => {
                    onClickTarget();
                    setPinnedPopoverId(null);
                    setActivePopoverId(null);
                  }}
                  data-testid="redirect-target-link"
                >
                  Switch to {targetDisplayName}
                </Button>
              </StackItem>
            </Stack>
          </StackItem>
        </Stack>
      );
    },
    [getMessageLevelColor, getMessageLevelText],
  );

  const hasChanged = useCallback(
    (step: SummaryStep): boolean => {
      if (!isEditMode) {
        return false;
      }
      switch (step) {
        case SummaryStep.KindSelection:
          return selectedKind?.name !== originalKind?.name;
        case SummaryStep.ImageSelection:
          return selectedImage?.id !== originalImage?.id;
        case SummaryStep.PodConfigSelection:
          return selectedPodConfig?.id !== originalPodConfig?.id;
        case SummaryStep.Properties:
          return properties.workspaceName !== originalProperties?.workspaceName;
        default:
          return false;
      }
    },
    [
      isEditMode,
      selectedKind,
      selectedImage,
      selectedPodConfig,
      properties,
      originalKind,
      originalImage,
      originalPodConfig,
      originalProperties,
    ],
  );

  const renderSummarySection = useCallback(
    (args: {
      step: SummaryStep;
      title: string;
      displayName: string | undefined;
      description: string | undefined;
      labels?: WorkspacekindsOptionLabel[] | Record<string, string>;
      redirect?: {
        to: string;
        message?: {
          level: WorkspacekindsRedirectMessageLevel;
          text: string;
        };
      };
      targetDisplayName?: string;
      onClickTarget?: () => void;
      originalDisplayName?: string;
      originalDescription?: string;
      originalLabels?: WorkspacekindsOptionLabel[] | Record<string, string>;
    }) => {
      const {
        step,
        title,
        displayName,
        description,
        labels,
        redirect,
        targetDisplayName,
        onClickTarget,
        originalDisplayName,
        originalDescription,
        originalLabels,
      } = args;

      // Show section if it has a value OR if we've already reached this step
      const hasValue = !!displayName;
      const hasBeenReached = currentStep >= step;

      if (!hasValue && !hasBeenReached) {
        return null;
      }

      const changed = hasChanged(step);

      const normalizedLabels = normalizeLabels(labels);
      const normalizedOriginalLabels = normalizeLabels(originalLabels);

      const renderRedirectIcon = (popoverIdSuffix: string) => {
        if (!redirect || !targetDisplayName || !onClickTarget) {
          return null;
        }

        return (
          <SummaryRedirectIcon
            step={step}
            popoverIdSuffix={popoverIdSuffix}
            displayName={displayName || ''}
            targetDisplayName={targetDisplayName}
            redirect={redirect}
            onClickTarget={onClickTarget}
            activePopoverId={activePopoverId}
            pinnedPopoverId={pinnedPopoverId}
            setActivePopoverId={setActivePopoverId}
            setPinnedPopoverId={setPinnedPopoverId}
            buildRedirectPopoverContent={buildRedirectPopoverContent}
          />
        );
      };

      return (
        <StackItem key={step}>
          <Card
            isCompact
            isClickable
            isSelectable
            className="summary-card--clickable"
            onClick={() => onNavigateToStep(step)}
            data-testid={`summary-card-${step}`}
          >
            <CardTitle>
              <Content component={ContentVariants.h3}>{title}</Content>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                {showDiff && changed ? (
                  <SummaryDiffSection
                    displayName={displayName}
                    description={description}
                    labels={normalizedLabels}
                    originalDisplayName={originalDisplayName}
                    originalDescription={originalDescription}
                    originalLabels={normalizedOriginalLabels}
                    redirectIcon={renderRedirectIcon('new')}
                  />
                ) : (
                  <SummaryContentSection
                    displayName={displayName}
                    description={description}
                    labels={normalizedLabels}
                    redirectIcon={renderRedirectIcon('current')}
                  />
                )}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      );
    },
    [
      currentStep,
      hasChanged,
      showDiff,
      onNavigateToStep,
      activePopoverId,
      pinnedPopoverId,
      buildRedirectPopoverContent,
    ],
  );

  return (
    <Stack hasGutter>
      <StackItem>
        <Content component={ContentVariants.p}>
          Review your options. Click a section to modify it.
        </Content>
      </StackItem>

      {renderSummarySection({
        step: SummaryStep.KindSelection,
        title: 'Workspace Kind',
        displayName: selectedKind?.displayName || selectedKind?.name,
        description: selectedKind?.description,
        labels: selectedKind?.podTemplate.podMetadata.labels,
        originalDisplayName: originalKind?.displayName || originalKind?.name,
        originalDescription: originalKind?.description,
        originalLabels: originalKind?.podTemplate.podMetadata.labels,
      })}

      {renderSummarySection({
        step: SummaryStep.ImageSelection,
        title: 'Image',
        displayName: selectedImage?.displayName,
        description: selectedImage?.description,
        labels: selectedImage?.labels,
        redirect: selectedImage?.redirect,
        targetDisplayName: selectedImage?.redirect
          ? selectedKind?.podTemplate.options.imageConfig.values.find(
              (img) => img.id === selectedImage.redirect?.to,
            )?.displayName
          : undefined,
        onClickTarget:
          selectedImage?.redirect && selectedKind
            ? () => {
                const targetImage = selectedKind.podTemplate.options.imageConfig.values.find(
                  (img) => img.id === selectedImage.redirect?.to,
                );
                if (targetImage) {
                  onSelectImage(targetImage);
                }
              }
            : undefined,
        originalDisplayName: originalImage?.displayName,
        originalDescription: originalImage?.description,
        originalLabels: originalImage?.labels,
      })}

      {renderSummarySection({
        step: SummaryStep.PodConfigSelection,
        title: 'Pod Config',
        displayName: selectedPodConfig?.displayName,
        description: selectedPodConfig?.description,
        labels: selectedPodConfig?.labels,
        redirect: selectedPodConfig?.redirect,
        targetDisplayName: selectedPodConfig?.redirect
          ? selectedKind?.podTemplate.options.podConfig.values.find(
              (pc) => pc.id === selectedPodConfig.redirect?.to,
            )?.displayName
          : undefined,
        onClickTarget:
          selectedPodConfig?.redirect && selectedKind
            ? () => {
                const targetPodConfig = selectedKind.podTemplate.options.podConfig.values.find(
                  (pc) => pc.id === selectedPodConfig.redirect?.to,
                );
                if (targetPodConfig) {
                  onSelectPodConfig(targetPodConfig);
                }
              }
            : undefined,
        originalDisplayName: originalPodConfig?.displayName,
        originalDescription: originalPodConfig?.description,
        originalLabels: originalPodConfig?.labels,
      })}

      {(properties.workspaceName.trim() || currentStep >= SummaryStep.Properties) && (
        <StackItem>
          <Card
            isCompact
            isClickable
            isSelectable
            className="summary-card--clickable"
            onClick={() => onNavigateToStep(SummaryStep.Properties)}
            data-testid="summary-card-3"
          >
            <CardTitle>
              <Content component={ContentVariants.h3}>Properties</Content>
            </CardTitle>
            <CardBody>
              <SummaryPropertiesSection
                properties={properties}
                originalProperties={originalProperties}
                showDiff={showDiff}
              />
            </CardBody>
          </Card>
        </StackItem>
      )}
    </Stack>
  );
};
