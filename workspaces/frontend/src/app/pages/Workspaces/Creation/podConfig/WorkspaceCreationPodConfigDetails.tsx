import React from 'react';
import { List, ListItem, Title } from '@patternfly/react-core';
import { WorkspacePodConfig } from '~/shared/types';

type WorkspaceCreationPodConfigDetailsProps = {
  workspacePodConfig?: WorkspacePodConfig;
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
          {Object.keys(workspacePodConfig.labels).map((labelKey) => (
            <ListItem key={labelKey}>
              {labelKey}={workspacePodConfig.labels[labelKey]}
            </ListItem>
          ))}
        </List>
      </>
    )}
  </>
);
