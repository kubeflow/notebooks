import React from 'react';
import { List, ListItem, Title } from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

type WorkspaceFormImageDetailsProps = {
  workspaceImage?: WorkspacePodConfigValue;
};

export const WorkspaceFormImageDetails: React.FunctionComponent<WorkspaceFormImageDetailsProps> = ({
  workspaceImage,
}) => (
  <div style={{ marginLeft: 'var(--pf-t--global--spacer--md)' }}>
    {workspaceImage && (
      <>
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
  </div>
);
