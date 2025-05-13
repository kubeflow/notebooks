import React from 'react';
import { List, ListItem, Title } from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

type WorkspaceCreationImageDetailsProps = {
  workspaceImage?: WorkspacePodConfigValue;
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
          {workspaceImage.labels.map((label) => (
            <ListItem key={label.key}>
              {label.key}={label.value}
            </ListItem>
          ))}
        </List>
      </>
    )}
  </>
);
