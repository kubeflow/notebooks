import React, { FC } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { WorkspaceFormProperties } from '~/app/types';

interface SummaryPropertiesSectionProps {
  properties: WorkspaceFormProperties;
  originalProperties?: WorkspaceFormProperties;
  showDiff: boolean;
}

export const SummaryPropertiesSection: FC<SummaryPropertiesSectionProps> = ({
  properties,
  originalProperties,
  showDiff,
}) => {
  const renderVolumeList = () => {
    const currentVolumeNames = properties.volumes.map((v) => v.pvcName);
    const originalVolumeNames = originalProperties?.volumes
      ? originalProperties.volumes.map((v) => v.pvcName)
      : [];

    if (showDiff && originalVolumeNames.length > 0) {
      const allVolumeNames = new Set([...originalVolumeNames, ...currentVolumeNames]);
      const volumeElements: React.ReactNode[] = [];

      allVolumeNames.forEach((name) => {
        const wasInOriginal = originalVolumeNames.includes(name);
        const isInCurrent = currentVolumeNames.includes(name);

        if (wasInOriginal && !isInCurrent) {
          volumeElements.push(
            <span key={name} className="strikethrough">
              {name}
            </span>,
          );
        } else {
          volumeElements.push(<span key={name}>{name}</span>);
        }
      });

      return volumeElements.reduce<React.ReactNode[]>(
        (acc, elem, idx) => (idx === 0 ? [elem] : [...acc, ', ', elem]),
        [],
      );
    }

    return currentVolumeNames.length > 0 ? currentVolumeNames.join(', ') : 'None';
  };

  const renderSecretList = () => {
    const currentSecretNames = properties.secrets.map((s) => s.secretName);
    const originalSecretNames = originalProperties?.secrets
      ? originalProperties.secrets.map((s) => s.secretName)
      : [];

    if (showDiff && originalSecretNames.length > 0) {
      const allSecretNames = new Set([...originalSecretNames, ...currentSecretNames]);
      const secretElements: React.ReactNode[] = [];

      allSecretNames.forEach((name) => {
        const wasInOriginal = originalSecretNames.includes(name);
        const isInCurrent = currentSecretNames.includes(name);

        if (wasInOriginal && !isInCurrent) {
          secretElements.push(
            <span key={name} className="strikethrough">
              {name}
            </span>,
          );
        } else {
          secretElements.push(<span key={name}>{name}</span>);
        }
      });

      return secretElements.reduce<React.ReactNode[]>(
        (acc, elem, idx) => (idx === 0 ? [elem] : [...acc, ', ', elem]),
        [],
      );
    }

    return currentSecretNames.length > 0 ? currentSecretNames.join(', ') : 'None';
  };

  return (
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
          <Content component={ContentVariants.small}>Data Volumes: {renderVolumeList()}</Content>
        </StackItem>
      )}

      {(properties.secrets.length > 0 ||
        (originalProperties?.secrets && originalProperties.secrets.length > 0)) && (
        <StackItem>
          <Content component={ContentVariants.small}>Secrets: {renderSecretList()}</Content>
        </StackItem>
      )}
    </Stack>
  );
};
