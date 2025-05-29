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
import { WorkspaceDetailsOverview } from './WorkspaceDetailsOverview';

type WorkspaceKindDetailsProps = {
  workspaceKind: WorkspaceKind;
  onCloseClick: React.MouseEventHandler;
};

export const WorkspaceKindDetails: React.FunctionComponent<WorkspaceKindDetailsProps> = ({
  workspaceKind,
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
            <WorkspaceDetailsOverview workspaceKind={workspaceKind} />
          </TabContentBody>
        </TabContent>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
