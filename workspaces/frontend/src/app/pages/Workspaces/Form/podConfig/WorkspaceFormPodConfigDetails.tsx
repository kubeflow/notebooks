import React from 'react';
import { List, ListItem } from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

type WorkspaceFormPodConfigDetailsProps = {
  workspacePodConfig?: WorkspacePodConfigValue;
};

export const WorkspaceFormPodConfigDetails: React.FunctionComponent<
  WorkspaceFormPodConfigDetailsProps
> = ({ workspacePodConfig }) => (
  <>
    {workspacePodConfig && (
      <div style={{ marginLeft: 'var(--pf-t--global--spacer--md)' }}>
        <p>{workspacePodConfig.description}</p>
        <List isPlain>
          {workspacePodConfig.labels.map((label) => (
            <ListItem key={label.key}>
              {label.key}={label.value}
            </ListItem>
          ))}
        </List>
      </div>
    )}
  </>
);
