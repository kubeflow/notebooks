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
    <DrawerPanelContent isResizable defaultSize="50%">
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
            <WorkspaceDetailsOverview workspace={workspace} />
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>Activity</TabTitleText>} aria-label="Activity">
            Activity
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>Logs</TabTitleText>} aria-label="Logs">
            Logs
          </Tab>
          <Tab
            eventKey={3}
            title={<TabTitleText>Pod template</TabTitleText>}
            aria-label="Pod template"
          >
            Pod template
          </Tab>
        </Tabs>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
