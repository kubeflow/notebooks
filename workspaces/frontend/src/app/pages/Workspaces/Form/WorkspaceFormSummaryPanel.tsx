import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { SummaryRedirectIcon } from '~/app/pages/Workspaces/Form/SummaryRedirectIcon';
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
  const showDiff = isEditMode && (originalKind || originalImage || originalPodConfig);

  // Popover state management
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [pinnedPopoverId, setPinnedPopoverId] = useState<string | null>(null);

  // Refs for delayed popover hiding
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringPopoverRef = useRef(false);

  // Clean up timeout on unmount
  useEffect(
    () => () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    },
    [],
  );

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

      // Helper to convert labels to consistent format
      const normalizeLabels = (
        labelData: WorkspacekindsOptionLabel[] | Record<string, string> | undefined,
      ): Record<string, string> | undefined => {
        if (!labelData) {
          return undefined;
        }
        if (Array.isArray(labelData)) {
          return labelData.reduce(
            (acc, label) => {
              acc[label.key] = label.value;
              return acc;
            },
            {} as Record<string, string>,
          );
        }
        return labelData;
      };

      const normalizedLabels = normalizeLabels(labels);
      const normalizedOriginalLabels = normalizeLabels(originalLabels);

      // Render redirect icon as a reusable component
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
            hideTimeoutRef={hideTimeoutRef}
            isHoveringPopoverRef={isHoveringPopoverRef}
          />
        );
      };

      return (
        <StackItem key={step}>
          <Card isCompact>
            <CardTitle>
              <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
                <FlexItem>
                  <Content component={ContentVariants.h3}>{title}</Content>
                </FlexItem>
                <FlexItem>
                  <Button
                    variant="plain"
                    aria-label={`Edit ${title}`}
                    onClick={() => onNavigateToStep(step)}
                    icon={<PencilAltIcon />}
                    data-testid={`summary-edit-${step}`}
                  />
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                {showDiff && changed ? (
                  <>
                    {/* NEW section */}
                    <StackItem>
                      <Content component={ContentVariants.p}>
                        <strong>NEW:</strong>
                      </Content>
                      <Flex
                        alignItems={{ default: 'alignItemsCenter' }}
                        spaceItems={{ default: 'spaceItemsSm' }}
                      >
                        {displayName && (
                          <FlexItem>
                            <Content component={ContentVariants.p}>{displayName}</Content>
                          </FlexItem>
                        )}
                        <FlexItem>{renderRedirectIcon('new')}</FlexItem>
                      </Flex>
                      {description && (
                        <Content component={ContentVariants.small}>{description}</Content>
                      )}
                      {normalizedLabels && Object.keys(normalizedLabels).length > 0 && (
                        <LabelGroup numLabels={5}>
                          {Object.entries(normalizedLabels).map(([key, value]) => (
                            <Label key={key} isCompact color="blue">
                              {key}: {value}
                            </Label>
                          ))}
                        </LabelGroup>
                      )}
                    </StackItem>
                    <Divider />
                    {/* OLD section */}
                    <StackItem>
                      <Content component={ContentVariants.p}>
                        <strong>OLD:</strong>
                      </Content>
                      {originalDisplayName && (
                        <Content component={ContentVariants.p}>{originalDisplayName}</Content>
                      )}
                      {originalDescription && (
                        <Content component={ContentVariants.small}>{originalDescription}</Content>
                      )}
                      {normalizedOriginalLabels &&
                        Object.keys(normalizedOriginalLabels).length > 0 && (
                          <LabelGroup numLabels={5}>
                            {Object.entries(normalizedOriginalLabels).map(([key, value]) => (
                              <Label key={key} isCompact>
                                {key}: {value}
                              </Label>
                            ))}
                          </LabelGroup>
                        )}
                    </StackItem>
                  </>
                ) : (
                  <>
                    <Flex
                      alignItems={{ default: 'alignItemsCenter' }}
                      spaceItems={{ default: 'spaceItemsSm' }}
                    >
                      {displayName && (
                        <FlexItem>
                          <Content component={ContentVariants.p}>{displayName}</Content>
                        </FlexItem>
                      )}
                      <FlexItem>{renderRedirectIcon('current')}</FlexItem>
                    </Flex>
                    {description && (
                      <Content component={ContentVariants.small}>{description}</Content>
                    )}
                    {normalizedLabels && Object.keys(normalizedLabels).length > 0 && (
                      <LabelGroup numLabels={5}>
                        {Object.entries(normalizedLabels).map(([key, value]) => (
                          <Label key={key} isCompact>
                            {key}: {value}
                          </Label>
                        ))}
                      </LabelGroup>
                    )}
                  </>
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
          Review your options. Click the edit icon to modify a section.
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
          <Card isCompact>
            <CardTitle>
              <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
                <FlexItem>
                  <Content component={ContentVariants.h3}>Properties</Content>
                </FlexItem>
                <FlexItem>
                  <Button
                    variant="plain"
                    aria-label="Edit Properties"
                    onClick={() => onNavigateToStep(SummaryStep.Properties)}
                    icon={<PencilAltIcon />}
                    data-testid="summary-edit-3"
                  />
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              <Stack hasGutter>
                <StackItem>
                  <Content component={ContentVariants.p}>
                    Name:{' '}
                    {showDiff && properties.workspaceName !== originalProperties?.workspaceName ? (
                      <>
                        <span className="strikethrough">{originalProperties?.workspaceName}</span>{' '}
                        {properties.workspaceName}
                      </>
                    ) : (
                      properties.workspaceName
                    )}
                  </Content>
                </StackItem>

                {(properties.homeVolume || originalProperties?.homeVolume) && (
                  <StackItem>
                    <Content component={ContentVariants.small}>
                      Home Volume:{' '}
                      {showDiff &&
                      properties.homeVolume?.pvcName !== originalProperties?.homeVolume?.pvcName ? (
                        <>
                          {originalProperties?.homeVolume?.pvcName && (
                            <>
                              <span className="strikethrough">
                                {originalProperties.homeVolume.pvcName}
                              </span>{' '}
                            </>
                          )}
                          {properties.homeVolume?.pvcName || 'None'}
                        </>
                      ) : (
                        properties.homeVolume?.pvcName || 'None'
                      )}
                    </Content>
                  </StackItem>
                )}

                {(properties.volumes.length > 0 ||
                  (originalProperties?.volumes && originalProperties.volumes.length > 0)) && (
                  <StackItem>
                    <Content component={ContentVariants.small}>
                      Data Volumes:{' '}
                      {(() => {
                        const currentVolumeNames = properties.volumes.map((v) => v.pvcName);
                        const originalVolumeNames = originalProperties?.volumes
                          ? originalProperties.volumes.map((v) => v.pvcName)
                          : [];

                        if (showDiff && originalVolumeNames.length > 0) {
                          // Combine all volume names and track their status
                          const allVolumeNames = new Set([
                            ...originalVolumeNames,
                            ...currentVolumeNames,
                          ]);
                          const volumeElements: React.ReactNode[] = [];

                          allVolumeNames.forEach((name) => {
                            const wasInOriginal = originalVolumeNames.includes(name);
                            const isInCurrent = currentVolumeNames.includes(name);

                            if (wasInOriginal && !isInCurrent) {
                              // Removed - show with strikethrough
                              volumeElements.push(
                                <span key={name} className="strikethrough">
                                  {name}
                                </span>,
                              );
                            } else {
                              // Added or unchanged - show normally
                              volumeElements.push(<span key={name}>{name}</span>);
                            }
                          });

                          // Join with commas
                          return volumeElements.reduce<React.ReactNode[]>(
                            (acc, elem, idx) => (idx === 0 ? [elem] : [...acc, ', ', elem]),
                            [],
                          );
                        }

                        return currentVolumeNames.length > 0
                          ? currentVolumeNames.join(', ')
                          : 'None';
                      })()}
                    </Content>
                  </StackItem>
                )}

                {(properties.secrets.length > 0 ||
                  (originalProperties?.secrets && originalProperties.secrets.length > 0)) && (
                  <StackItem>
                    <Content component={ContentVariants.small}>
                      Secrets:{' '}
                      {(() => {
                        const currentSecretNames = properties.secrets.map((s) => s.secretName);
                        const originalSecretNames = originalProperties?.secrets
                          ? originalProperties.secrets.map((s) => s.secretName)
                          : [];

                        if (showDiff && originalSecretNames.length > 0) {
                          // Combine all secret names and track their status
                          const allSecretNames = new Set([
                            ...originalSecretNames,
                            ...currentSecretNames,
                          ]);
                          const secretElements: React.ReactNode[] = [];

                          allSecretNames.forEach((name) => {
                            const wasInOriginal = originalSecretNames.includes(name);
                            const isInCurrent = currentSecretNames.includes(name);

                            if (wasInOriginal && !isInCurrent) {
                              // Removed - show with strikethrough
                              secretElements.push(
                                <span key={name} className="strikethrough">
                                  {name}
                                </span>,
                              );
                            } else {
                              // Added or unchanged - show normally
                              secretElements.push(<span key={name}>{name}</span>);
                            }
                          });

                          // Join with commas
                          return secretElements.reduce<React.ReactNode[]>(
                            (acc, elem, idx) => (idx === 0 ? [elem] : [...acc, ', ', elem]),
                            [],
                          );
                        }

                        return currentSecretNames.length > 0
                          ? currentSecretNames.join(', ')
                          : 'None';
                      })()}
                    </Content>
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
        </StackItem>
      )}
    </Stack>
  );
};
