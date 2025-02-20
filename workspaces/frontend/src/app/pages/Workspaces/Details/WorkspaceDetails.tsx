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
import { Workspace } from '~/shared/types';
import { WorkspaceDetailsOverview } from '~/app/pages/Workspaces/Details/WorkspaceDetailsOverview';
import { WorkspaceDetailsActions } from '~/app/pages/Workspaces/Details/WorkspaceDetailsActions';
import { WorkspaceDetailsActivity } from '~/app/pages/Workspaces/Details/WorkspaceDetailsActivity';
import { WorkspaceDetailsPodTemplate } from '~/app/pages/Workspaces/Details/WorkspaceDetailsPodTemplate';

type WorkspaceDetailsProps = {
  workspace: Workspace;
  onCloseClick: React.MouseEventHandler;
  onEditClick: React.MouseEventHandler;
  onDeleteClick: React.MouseEventHandler;
};

export const WorkspaceDetails: React.FunctionComponent<WorkspaceDetailsProps> = ({
  workspace,
  onCloseClick,
  onEditClick,
  onDeleteClick,
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
        <Title headingLevel="h6">{workspace.name}</Title>
        <WorkspaceDetailsActions onEditClick={onEditClick} onDeleteClick={onDeleteClick} />
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
            title={<TabTitleText>Activity</TabTitleText>}
            tabContentId="activityTabContent"
            aria-label="Activity"
            data-testid="activityTab"
          />
          <Tab
            eventKey={2}
            title={<TabTitleText>Logs</TabTitleText>}
            tabContentId="logsTabContent"
            aria-label="Logs"
          />
          <Tab
            eventKey={3}
            title={<TabTitleText>Pod template</TabTitleText>}
            tabContentId="podTemplateTabContent"
            aria-label="Pod template"
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
            <WorkspaceDetailsOverview workspace={workspace} />
          </TabContentBody>
        </TabContent>

        <TabContent
          key={1}
          eventKey={1}
          id="activityTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== 1}
        >
          <TabContentBody hasPadding>
            <WorkspaceDetailsActivity workspace={workspace} />
          </TabContentBody>
        </TabContent>

        <TabContent
          key={2}
          eventKey={2}
          id="logsTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== 2}
        >
          <TabContentBody hasPadding>Logs</TabContentBody>
        </TabContent>

        <TabContent
          key={3}
          style={{ height: '100%' }}
          eventKey={3}
          id="podTemplateTabContent"
          activeKey={activeTabKey}
          hidden={activeTabKey !== 3}
        >
          <TabContentBody style={{ height: '100%' }} hasPadding>
            <WorkspaceDetailsPodTemplate />
          </TabContentBody>
        </TabContent>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
