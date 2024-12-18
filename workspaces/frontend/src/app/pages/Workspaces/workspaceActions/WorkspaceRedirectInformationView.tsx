import { ExpandableSection, Icon, Tab, Tabs, TabTitleText, Content } from '@patternfly/react-core';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
} from '@patternfly/react-icons';
import * as React from 'react';

// remove when changing to fetch data from BE
const mockedWorkspaceKind = {
  name: 'jupyter-lab',
  displayName: 'JupyterLab Notebook',
  description: 'A Workspace which runs JupyterLab in a Pod',
  deprecated: false,
  deprecationMessage: '',
  hidden: false,
  icon: {
    url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
  },
  logo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
  },
  podTemplate: {
    podMetadata: {
      labels: { myWorkspaceKindLabel: 'my-value' },
      annotations: { myWorkspaceKindAnnotation: 'my-value' },
    },
    volumeMounts: { home: '/home/jovyan' },
    options: {
      imageConfig: {
        default: 'jupyterlab_scipy_190',
        values: [
          {
            id: 'jupyterlab_scipy_180',
            displayName: 'jupyter-scipy:v1.8.0',
            labels: { pythonVersion: '3.11' },
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_190',
              message: {
                text: 'This update will change...',
                level: 'Info',
              },
            },
          },
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            labels: { pythonVersion: '3.11' },
            hidden: true,
            redirect: {
              to: 'jupyterlab_scipy_200',
              message: {
                text: 'This update will change...',
                level: 'Warning',
              },
            },
          },
        ],
      },
      podConfig: {
        default: 'tiny_cpu',
        values: [
          {
            id: 'tiny_cpu',
            displayName: 'Tiny CPU',
            description: 'Pod with 0.1 CPU, 128 Mb RAM',
            labels: { cpu: '100m', memory: '128Mi' },
            redirect: {
              to: 'small_cpu',
              message: {
                text: 'This update will change...',
                level: 'Danger',
              },
            },
          },
        ],
      },
    },
  },
};

const getLevelIcon = (level: string) => {
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

export const WorkspaceRedirectInformationView: React.FC = () => {
  const [activeKey, setActiveKey] = React.useState<string | number>(0);
  // change this to get from BE, and use the workspaceKinds API
  const workspaceKind = mockedWorkspaceKind;

  const { imageConfig } = workspaceKind.podTemplate.options;
  const { podConfig } = workspaceKind.podTemplate.options;

  const imageConfigRedirects = imageConfig.values.map((value) => ({
    src: value.id,
    dest: value.redirect.to,
    message: value.redirect.message.text,
    level: value.redirect.message.level,
  }));
  const podConfigRedirects = podConfig.values.map((value) => ({
    src: value.id,
    dest: value.redirect.to,
    message: value.redirect.message.text,
    level: value.redirect.message.level,
  }));

  const getMaxLevel = (
    redirects: { dest: string; level: string; message: string; src: string }[],
  ) => {
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
    <Tabs activeKey={activeKey} onSelect={(event, eventKey) => setActiveKey(eventKey)}>
      {imageConfigRedirects.length > 0 && (
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
      {podConfigRedirects.length > 0 && (
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
