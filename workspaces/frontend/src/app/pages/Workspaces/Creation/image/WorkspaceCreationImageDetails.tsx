import React from 'react';
import { List, ListItem, Title } from '@patternfly/react-core';
import { WorkspaceImage } from '~/shared/types';

type WorkspaceCreationImageDetailsProps = {
  workspaceImage?: WorkspaceImage;
};

export const WorkspaceCreationImageDetails: React.FunctionComponent<
  WorkspaceCreationImageDetailsProps
> = ({ workspaceImage }) => (
  <>
    {!workspaceImage && <p>Select an image to view its details here.</p>}

    {workspaceImage && (
      <>
        <Title headingLevel="h6">Image</Title>
        <Title headingLevel="h3">{workspaceImage.displayName}</Title>
        <br />
        <List isPlain>
          {Object.keys(workspaceImage.labels).map((labelKey) => (
            <ListItem key={labelKey}>
              {labelKey}={workspaceImage.labels[labelKey]}
            </ListItem>
          ))}
        </List>
      </>
    )}
  </>
);
