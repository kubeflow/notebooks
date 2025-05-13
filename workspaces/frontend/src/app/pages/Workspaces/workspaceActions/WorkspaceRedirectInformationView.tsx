import { ExpandableSection, Icon, Tab, Tabs, TabTitleText, Content } from '@patternfly/react-core';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
} from '@patternfly/react-icons';
import * as React from 'react';
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
  const [activeKey, setActiveKey] = React.useState<string | number>(0);
  const [workspaceKind, workspaceKindLoaded] = useWorkspaceKindByName(kind);
  const [imageConfig, setImageConfig] =
    React.useState<WorkspaceKind['podTemplate']['options']['imageConfig']>();
  const [podConfig, setPodConfig] =
    React.useState<WorkspaceKind['podTemplate']['options']['podConfig']>();

  React.useEffect(() => {
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
