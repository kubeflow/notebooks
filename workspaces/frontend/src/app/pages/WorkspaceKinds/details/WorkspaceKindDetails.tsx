import React from 'react';
import {
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Tabs,
  Tab,
  TabTitleText,
  Title,
  TabContentBody,
  TabContent,
} from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspaceKindDetailsOverview } from './WorkspaceKindDetailsOverview';
import { WorkspaceKindDetailsImages } from './WorkspaceKindDetailsImages';

type WorkspaceKindDetailsProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
  onCloseClick: React.MouseEventHandler;
};

export const WorkspaceKindDetails: React.FunctionComponent<WorkspaceKindDetailsProps> = ({
  workspaceKind,
  workspaceCountPerKind,
  onCloseClick,
}) => {
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0);

  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => {
    setActiveTabKey(tabIndex);
  };

  return (
    <DrawerPanelContent data-testid="workspaceDetails">
      <DrawerHead>
        <Title headingLevel="h6">{workspaceKind.name}</Title>
        <DrawerActions>
          <DrawerCloseButton onClick={onCloseClick} />
        </DrawerActions>
      </DrawerHead>

      <DrawerPanelBody>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick}>
          <Tab
            eventKey={0}
            title={<TabTitleText>Overview</TabTitleText>}
            tabContentId="overviewTabContent"
            aria-label="Overview"
          />
          <Tab
            eventKey={1}
            title={<TabTitleText>Images</TabTitleText>}
            tabContentId="imagesTabContent"
            aria-label="Images"
          />
        </Tabs>
      </DrawerPanelBody>

      <DrawerPanelBody>
        <TabContent
          key={0}
          eventKey={0}
          id="overviewTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== 0}
        >
          <TabContentBody hasPadding>
            <WorkspaceKindDetailsOverview workspaceKind={workspaceKind} />
          </TabContentBody>
        </TabContent>
        <TabContent
          key={1}
          eventKey={1}
          id="imagesTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== 1}
        >
          <TabContentBody hasPadding>
            <WorkspaceKindDetailsImages
              workspaceKind={workspaceKind}
              workspaceCountPerKind={workspaceCountPerKind}
            />
          </TabContentBody>
        </TabContent>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
