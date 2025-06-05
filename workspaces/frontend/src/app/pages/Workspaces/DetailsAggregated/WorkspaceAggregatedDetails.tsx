import React from 'react';
import {
  Button,
  DrawerActions,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Title,
} from '@patternfly/react-core';
import { WorkspaceAggregatedDetailsActions } from '~/app/pages/Workspaces/DetailsAggregated/WorkspaceAggregatedDetailsActions';

type WorkspaceAggregatedDetailsProps = {
  workspaceNames: string[];
  onCloseClick: React.MouseEventHandler;
  onDeleteClick: React.MouseEventHandler;
};

export const WorkspaceAggregatedDetails: React.FunctionComponent<
  WorkspaceAggregatedDetailsProps
> = ({ workspaceNames, onCloseClick, onDeleteClick }) => (
  <DrawerPanelContent>
    <DrawerHead>
      <Title headingLevel="h6">Multiple selected workspaces</Title>
      <WorkspaceAggregatedDetailsActions onDeleteClick={onDeleteClick} />
      <DrawerActions>
        <Button onClick={onCloseClick} aria-label="Clear workspoaces selection" variant="link">
          Clear selection
        </Button>
      </DrawerActions>
    </DrawerHead>
    <DrawerPanelBody>
      <Title headingLevel="h6" size="md">
        {'Selected workspaces: '}
      </Title>
      {workspaceNames.join(', ')}
    </DrawerPanelBody>
  </DrawerPanelContent>
);
