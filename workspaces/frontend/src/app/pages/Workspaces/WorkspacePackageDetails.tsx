import * as React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListDescription,
  ListItem,
  List,
  DescriptionListGroup,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/api/backendApiTypes';
import { WorkspaceFormImageDetails } from './Form/image/WorkspaceFormImageDetails';

interface WorkspacePackageDetailsProps {
  workspace: Workspace;
}

export const WorkspacePackageDetails: React.FC<WorkspacePackageDetailsProps> = ({ workspace }) => {
  const imageConfig = workspace.podTemplate.options.imageConfig.current;
  const jupyterLabVersion = imageConfig.labels.find(
    (label) => label.key === 'jupyterlabVersion',
  )?.value;
  const pythonVersion = imageConfig.labels.find((label) => label.key === 'pythonVersion')?.value;

  return (
    <DescriptionList>
      <DescriptionListGroup>
        <DescriptionListTerm>Packages</DescriptionListTerm>
        <DescriptionListDescription>
          <List isPlain>
            {jupyterLabVersion && (
              <ListItem key="jupyterlab">JupyterLab v{jupyterLabVersion}</ListItem>
            )}
            {pythonVersion && <ListItem key="python">Python v{pythonVersion}</ListItem>}
          </List>
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};
