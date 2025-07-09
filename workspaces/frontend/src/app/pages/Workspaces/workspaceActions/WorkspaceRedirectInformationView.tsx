import React, { useEffect, useState } from 'react';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { Tab, Tabs, TabTitleText } from '@patternfly/react-core/dist/esm/components/Tabs';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';

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

interface WorkspaceRedirectInformationViewProps {
  kind: string;
}

export const WorkspaceRedirectInformationView: React.FC<WorkspaceRedirectInformationViewProps> = ({
  kind,
}) => {
  const [activeKey, setActiveKey] = useState<string | number>(0);
  const [workspaceKind, workspaceKindLoaded] = useWorkspaceKindByName(kind);
  const [imageConfig, setImageConfig] =
    useState<WorkspaceKind['podTemplate']['options']['imageConfig']>();
  const [podConfig, setPodConfig] =
    useState<WorkspaceKind['podTemplate']['options']['podConfig']>();

  useEffect(() => {
    if (!workspaceKindLoaded) {
      return;
    }
    setImageConfig(workspaceKind?.podTemplate.options.imageConfig);
    setPodConfig(workspaceKind?.podTemplate.options.podConfig);
  }, [workspaceKindLoaded, workspaceKind]);

  const imageConfigRedirects = imageConfig?.values.map((value) => ({
    src: value.id,
    dest: value.redirect?.to,
    message: value.redirect?.message?.text,
    level: value.redirect?.message?.level,
  }));
  const podConfigRedirects = podConfig?.values.map((value) => ({
    src: value.id,
    dest: value.redirect?.to,
    message: value.redirect?.message?.text,
    level: value.redirect?.message?.level,
  }));

  const getMaxLevel = (redirects: NonNullable<typeof imageConfigRedirects>) => {
    let maxLevel = redirects[0].level;
    redirects.forEach((redirect) => {
      if (
        (maxLevel === 'Info' && (redirect.level === 'Warning' || redirect.level === 'Danger')) ||
        (maxLevel === 'Warning' && redirect.level === 'Danger')
      ) {
        maxLevel = redirect.level;
      }
    });
    return maxLevel;
  };

  return (
    <Tabs activeKey={activeKey} onSelect={(_event, eventKey) => setActiveKey(eventKey)}>
      {imageConfigRedirects && imageConfigRedirects.length > 0 && (
        <Tab
          eventKey={0}
          title={
            <TabTitleText>
              Image Config {getLevelIcon(getMaxLevel(imageConfigRedirects))}
            </TabTitleText>
          }
        >
          {imageConfigRedirects.map((redirect, index) => (
            <Content style={{ display: 'flex', alignItems: 'baseline' }} key={index}>
              {getLevelIcon(redirect.level)}
              <ExpandableSection toggleText={` ${redirect.src} -> ${redirect.dest}`}>
                <Content>{redirect.message}</Content>
              </ExpandableSection>
            </Content>
          ))}
        </Tab>
      )}
      {podConfigRedirects && podConfigRedirects.length > 0 && (
        <Tab
          eventKey={1}
          title={
            <TabTitleText>Pod Config {getLevelIcon(getMaxLevel(podConfigRedirects))}</TabTitleText>
          }
        >
          {podConfigRedirects.map((redirect, index) => (
            <Content style={{ display: 'flex', alignItems: 'baseline' }} key={index}>
              {getLevelIcon(redirect.level)}
              <ExpandableSection toggleText={` ${redirect.src} -> ${redirect.dest}`}>
                <Content>{redirect.message}</Content>
              </ExpandableSection>
            </Content>
          ))}
        </Tab>
      )}
    </Tabs>
  );
};
