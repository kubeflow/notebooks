import React, { useMemo, useState } from 'react';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { Tab, Tabs, TabTitleText } from '@patternfly/react-core/dist/esm/components/Tabs';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import { WorkspacesRedirectStep } from '~/generated/data-contracts';

const getLevelIcon = (level: string | undefined) => {
  switch (level) {
    case 'Info':
      return (
        <Icon status="info">
          <InfoCircleIcon />
        </Icon>
      );
    case 'Warning':
      return (
        <Icon status="warning">
          <ExclamationTriangleIcon />
        </Icon>
      );
    case 'Danger':
      return (
        <Icon status="danger">
          <ExclamationCircleIcon />
        </Icon>
      );
    default:
      return (
        <Icon status="info">
          <InfoCircleIcon />
        </Icon>
      );
  }
};

export const WorkspaceRedirectInformationViewTitle: React.FC = () => (
  <Content>
    There are pending redirect updates for that workspace. Are you sure you want to proceed?
    <Alert
      variant="info"
      isInline
      isPlain
      title="Applying the pending redirect updates will delete and recreate the workspace. Any data not saved to persistent storage will be lost. "
    />
  </Content>
);

interface WorkspaceRedirectInformationViewProps {
  podConfigRedirects?: WorkspacesRedirectStep[];
  imageConfigRedirects?: WorkspacesRedirectStep[];
}

export const WorkspaceRedirectInformationView: React.FC<WorkspaceRedirectInformationViewProps> = ({
  podConfigRedirects = [],
  imageConfigRedirects = [],
}) => {
  const [activeKey, setActiveKey] = useState<string | number>(0);
  const imageMappedRedirects = useMemo(
    () =>
      imageConfigRedirects.map((value) => ({
        src: value.source,
        dest: value.target,
        message: value.message?.text,
        level: value.message?.level,
      })),
    [imageConfigRedirects],
  );

  const podMappedRedirects = useMemo(
    () =>
      podConfigRedirects.map((value) => ({
        src: value.source,
        dest: value.target,
        message: value.message?.text,
        level: value.message?.level,
      })),
    [podConfigRedirects],
  );

  const getMaxLevel = (redirects: NonNullable<typeof imageConfigRedirects>) => {
    let maxLevel = redirects[0].message?.level;
    redirects.forEach((redirect) => {
      if (
        (maxLevel === 'Info' &&
          (redirect.message?.level === 'Warning' || redirect.message?.level === 'Danger')) ||
        (maxLevel === 'Warning' && redirect.message?.level === 'Danger')
      ) {
        maxLevel = redirect.message.level;
      }
    });
    return maxLevel;
  };

  return (
    <Tabs activeKey={activeKey} onSelect={(_event, eventKey) => setActiveKey(eventKey)}>
      {imageConfigRedirects.length > 0 && (
        <Tab
          eventKey={0}
          title={
            <TabTitleText>
              Image config {getLevelIcon(getMaxLevel(imageConfigRedirects))}
            </TabTitleText>
          }
        >
          {imageMappedRedirects.map((redirect, index) => (
            <Content style={{ display: 'flex', alignItems: 'baseline' }} key={index}>
              {getLevelIcon(redirect.level)}
              <ExpandableSection
                toggleText={` ${redirect.src.displayName} -> ${redirect.dest.displayName}`}
              >
                <Content>{redirect.message}</Content>
              </ExpandableSection>
            </Content>
          ))}
        </Tab>
      )}
      {podConfigRedirects.length > 0 && (
        <Tab
          eventKey={imageConfigRedirects.length > 0 ? 1 : 0}
          title={
            <TabTitleText>Pod config {getLevelIcon(getMaxLevel(podConfigRedirects))}</TabTitleText>
          }
        >
          {podMappedRedirects.map((redirect, index) => (
            <Content style={{ display: 'flex', alignItems: 'baseline' }} key={index}>
              {getLevelIcon(redirect.level)}
              <ExpandableSection
                toggleText={` ${redirect.src.displayName} -> ${redirect.dest.displayName}`}
              >
                <Content>{redirect.message}</Content>
              </ExpandableSection>
            </Content>
          ))}
        </Tab>
      )}
    </Tabs>
  );
};
