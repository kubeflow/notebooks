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
  const renderVolumeLabels = () => {
    const currentVolumeNames = properties.volumes.map((v) => v.pvcName);
    const originalVolumeNames = originalProperties?.volumes
      ? originalProperties.volumes.map((v) => v.pvcName)
      : [];

    if (showDiff && originalVolumeNames.length > 0) {
      const allVolumeNames = new Set([...originalVolumeNames, ...currentVolumeNames]);

      return (
        <LabelGroup numLabels={5}>
          {[...allVolumeNames].map((name) => {
            const wasInOriginal = originalVolumeNames.includes(name);
            const isInCurrent = currentVolumeNames.includes(name);

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

    if (currentVolumeNames.length === 0) {
      return 'None';
    }

    return (
      <LabelGroup numLabels={5}>
        {currentVolumeNames.map((name) => (
          <Label key={name} isCompact>
            {name}
          </Label>
        ))}
      </LabelGroup>
    );
  };

  const renderSecretLabels = () => {
    const currentSecretNames = properties.secrets.map((s) => s.secretName);
    const originalSecretNames = originalProperties?.secrets
      ? originalProperties.secrets.map((s) => s.secretName)
      : [];

    if (showDiff && originalSecretNames.length > 0) {
      const allSecretNames = new Set([...originalSecretNames, ...currentSecretNames]);

      return (
        <LabelGroup numLabels={5}>
          {[...allSecretNames].map((name) => {
            const wasInOriginal = originalSecretNames.includes(name);
            const isInCurrent = currentSecretNames.includes(name);

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

    if (currentSecretNames.length === 0) {
      return 'None';
    }

    return (
      <LabelGroup numLabels={5}>
        {currentSecretNames.map((name) => (
          <Label key={name} isCompact>
            {name}
          </Label>
        ))}
      </LabelGroup>
    );
  };

  const renderHomeVolumeLabel = () => {
    const currentPvc = properties.homeVolume?.pvcName;
    const originalPvc = originalProperties?.homeVolume?.pvcName;

    if (showDiff && currentPvc !== originalPvc) {
      return (
        <LabelGroup>
          {originalPvc && (
            <Label isCompact className="strikethrough">
              {originalPvc}
            </Label>
          )}
          {currentPvc ? (
            <Label isCompact color="blue">
              {currentPvc}
            </Label>
          ) : (
            'None'
          )}
        </LabelGroup>
      );
    }

    return currentPvc ? <Label isCompact>{currentPvc}</Label> : 'None';
  };

  return (
    <Stack hasGutter>
      {!isEditMode && (
        <StackItem>
          <Content component={ContentVariants.p}>Name: {properties.workspaceName}</Content>
        </StackItem>
      )}

      {(properties.homeVolume || originalProperties?.homeVolume) && (
        <StackItem>
          <Content component={ContentVariants.small}>
            Home Volume: {renderHomeVolumeLabel()}
          </Content>
        </StackItem>
      )}

      {(properties.volumes.length > 0 ||
        (originalProperties?.volumes && originalProperties.volumes.length > 0)) && (
        <StackItem>
          <Content component={ContentVariants.small}>Data Volumes: {renderVolumeLabels()}</Content>
        </StackItem>
      )}

      {(properties.secrets.length > 0 ||
        (originalProperties?.secrets && originalProperties.secrets.length > 0)) && (
        <StackItem>
          <Content component={ContentVariants.small}>Secrets: {renderSecretLabels()}</Content>
        </StackItem>
      )}
    </Stack>
  );
};
