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
    <DrawerPanelContent>
      <DrawerHead>
        <Title headingLevel="h6">{workspace.name}</Title>
        <WorkspaceDetailsActions onEditClick={onEditClick} onDeleteClick={onDeleteClick} />
        <DrawerActions>
          <DrawerCloseButton onClick={onCloseClick} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick}>
          <Tab eventKey={0} title={<TabTitleText>Overview</TabTitleText>} aria-label="Overview">
            <TabContent id="overviewSectionBodyPadding">
              <TabContentBody hasPadding>
                <WorkspaceDetailsOverview workspace={workspace} />
              </TabContentBody>
            </TabContent>
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>Activity</TabTitleText>} aria-label="Activity">
            <TabContent id="activitySectionBodyPadding">
              <TabContentBody hasPadding>Activity</TabContentBody>
            </TabContent>
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>Logs</TabTitleText>} aria-label="Logs">
            <TabContent id="logsSectionBodyPadding">
              <TabContentBody hasPadding>Logs</TabContentBody>
            </TabContent>
          </Tab>
          <Tab
            eventKey={3}
            title={<TabTitleText>Pod template</TabTitleText>}
            aria-label="Pod template"
          >
            <TabContent id="podTemplateBodyPadding">
              <TabContentBody hasPadding>Pod template</TabContentBody>
            </TabContent>
          </Tab>
        </Tabs>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
