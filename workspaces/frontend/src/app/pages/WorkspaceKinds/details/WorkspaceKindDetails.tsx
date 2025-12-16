import React, { useState } from 'react';
import {
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelContent,
  DrawerPanelBody,
} from '@patternfly/react-core/dist/esm/components/Drawer';
import {
  Tabs,
  Tab,
  TabTitleText,
  TabContentBody,
  TabContent,
} from '@patternfly/react-core/dist/esm/components/Tabs';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { WorkspaceCountResult } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspaceKindDetailsNamespaces } from '~/app/pages/WorkspaceKinds/details/WorkspaceKindDetailsNamespaces';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindDetailsOverview } from './WorkspaceKindDetailsOverview';
import { WorkspaceKindDetailsImages } from './WorkspaceKindDetailsImages';
import { WorkspaceKindDetailsPodConfigs } from './WorkspaceKindDetailsPodConfigs';

type WorkspaceKindDetailsProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
  workspaceCountResult: WorkspaceCountResult;
  onCloseClick: React.MouseEventHandler;
};

export const WorkspaceKindDetails: React.FunctionComponent<WorkspaceKindDetailsProps> = ({
  workspaceKind,
  workspaceCountResult,
  onCloseClick,
}) => {
  const overviewTabKey = 0;
  const imagesTabKey = 1;
  const podConfigsTabKey = 2;
  const namespacesTabKey = 3;

  const [activeTabKey, setActiveTabKey] = useState<string | number>(overviewTabKey);

  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => {
    setActiveTabKey(tabIndex);
  };

  return (
    <DrawerPanelContent minSize="45%" isResizable data-testid="workspaceDetails">
      <DrawerHead>
        <Title headingLevel="h6" data-testid="workspace-kind-details-title">
          {workspaceKind.name}
        </Title>
        <DrawerActions>
          <DrawerCloseButton onClick={onCloseClick} data-testid="workspace-kind-details-close" />
        </DrawerActions>
      </DrawerHead>

      <DrawerPanelBody>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick}>
          <Tab
            eventKey={overviewTabKey}
            title={<TabTitleText>Overview</TabTitleText>}
            tabContentId="overviewTabContent"
            aria-label="Overview"
            data-testid="overview-tab"
          />
          <Tab
            eventKey={imagesTabKey}
            title={<TabTitleText>Images</TabTitleText>}
            tabContentId="imagesTabContent"
            aria-label="Images"
            data-testid="images-tab"
          />
          <Tab
            eventKey={podConfigsTabKey}
            title={<TabTitleText>Pod configs</TabTitleText>}
            tabContentId="podConfigsTabContent"
            aria-label="Pod Configs"
            data-testid="pod-configs-tab"
          />
          <Tab
            eventKey={namespacesTabKey}
            title={<TabTitleText>Namespaces</TabTitleText>}
            tabContentId="namespacesTabContent"
            aria-label="Namespaces"
            data-testid="namespaces-tab"
          />
        </Tabs>
      </DrawerPanelBody>

      <DrawerPanelBody>
        <TabContent
          key={overviewTabKey}
          eventKey={overviewTabKey}
          id="overviewTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== overviewTabKey}
        >
          <TabContentBody hasPadding>
            <WorkspaceKindDetailsOverview workspaceKind={workspaceKind} />
          </TabContentBody>
        </TabContent>
        <TabContent
          key={imagesTabKey}
          eventKey={imagesTabKey}
          id="imagesTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== imagesTabKey}
        >
          <TabContentBody hasPadding>
            <WorkspaceKindDetailsImages
              workspaceKind={workspaceKind}
              workspaceCountResult={workspaceCountResult}
            />
          </TabContentBody>
        </TabContent>
        <TabContent
          key={podConfigsTabKey}
          eventKey={podConfigsTabKey}
          id="podConfigsTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== podConfigsTabKey}
        >
          <TabContentBody hasPadding>
            <WorkspaceKindDetailsPodConfigs
              workspaceKind={workspaceKind}
              workspaceCountResult={workspaceCountResult}
            />
          </TabContentBody>
        </TabContent>
        <TabContent
          key={namespacesTabKey}
          eventKey={namespacesTabKey}
          id="namespacesTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== namespacesTabKey}
        >
          <TabContentBody hasPadding>
            <WorkspaceKindDetailsNamespaces
              workspaceKind={workspaceKind}
              workspaceCountResult={workspaceCountResult}
            />
          </TabContentBody>
        </TabContent>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
