import React from 'react';
import { List, ListItem, Title } from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

type WorkspaceCreationPodConfigDetailsProps = {
  workspacePodConfig?: WorkspacePodConfigValue;
};

export const WorkspaceCreationPodConfigDetails: React.FunctionComponent<
  WorkspaceCreationPodConfigDetailsProps
> = ({ workspacePodConfig }) => (
  <>
    {!workspacePodConfig && <p>Select a pod config to view its details here.</p>}

    {workspacePodConfig && (
      <>
        <Title headingLevel="h6">Pod config</Title>
        <Title headingLevel="h3">{workspacePodConfig.displayName}</Title>
        <p>{workspacePodConfig.description}</p>
        <List isPlain>
          {workspacePodConfig.labels.map((label) => (
            <ListItem key={label.key}>
              {label.key}={label.value}
            </ListItem>
          ))}
        </List>
      </>
    )}
  </>
);
