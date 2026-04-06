import React, { FC } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { WorkspaceFormMode, WorkspaceFormProperties } from '~/app/types';

interface SummaryPropertiesSectionProps {
  properties: WorkspaceFormProperties;
  originalProperties?: WorkspaceFormProperties;
  showDiff: boolean;
  mode: WorkspaceFormMode;
}

export const SummaryPropertiesSection: FC<SummaryPropertiesSectionProps> = ({
  properties,
  originalProperties,
  showDiff,
  mode,
}) => {
  const isEditMode = mode === 'update';

  const renderDiffLabelGroup = (currentNames: string[], originalNames: string[]) => {
    if (showDiff && originalNames.length > 0) {
      const allNames = new Set([...originalNames, ...currentNames]);

      return (
        <LabelGroup numLabels={5}>
          {[...allNames].map((name) => {
            const wasInOriginal = originalNames.includes(name);
            const isInCurrent = currentNames.includes(name);

            if (wasInOriginal && !isInCurrent) {
              return (
                <Label key={name} isCompact className="strikethrough">
                  {name}
                </Label>
              );
            }
            return (
              <Label
                key={name}
                isCompact
                color={!wasInOriginal && isInCurrent ? 'blue' : undefined}
              >
                {name}
              </Label>
            );
          })}
        </LabelGroup>
      );
    }

    if (currentNames.length === 0) {
      return 'None';
    }

    return (
      <LabelGroup numLabels={5}>
        {currentNames.map((name) => (
          <Label key={name} isCompact color={originalNames.length === 0 ? 'blue' : undefined}>
            {name}
          </Label>
        ))}
      </LabelGroup>
    );
  };

  return (
    <Stack hasGutter>
      {!isEditMode && properties.workspaceName.trim() && (
        <StackItem>
          <Content component={ContentVariants.p}>Name: {properties.workspaceName}</Content>
        </StackItem>
      )}

      {(properties.homeVolume || originalProperties?.homeVolume) && (
        <StackItem>
          <Content component={ContentVariants.small}>
            Home Volume:{' '}
            {renderDiffLabelGroup(
              properties.homeVolume ? [properties.homeVolume.pvcName] : [],
              originalProperties?.homeVolume ? [originalProperties.homeVolume.pvcName] : [],
            )}
          </Content>
        </StackItem>
      )}

      {(properties.volumes.length > 0 ||
        (originalProperties?.volumes && originalProperties.volumes.length > 0)) && (
        <StackItem>
          <Content component={ContentVariants.small}>
            Data Volumes:{' '}
            {renderDiffLabelGroup(
              properties.volumes.map((v) => v.pvcName),
              originalProperties?.volumes.map((v) => v.pvcName) ?? [],
            )}
          </Content>
        </StackItem>
      )}

      {(properties.secrets.length > 0 ||
        (originalProperties?.secrets && originalProperties.secrets.length > 0)) && (
        <StackItem>
          <Content component={ContentVariants.small}>
            Secrets:{' '}
            {renderDiffLabelGroup(
              properties.secrets.map((s) => s.secretName),
              originalProperties?.secrets.map((s) => s.secretName) ?? [],
            )}
          </Content>
        </StackItem>
      )}
    </Stack>
  );
};
