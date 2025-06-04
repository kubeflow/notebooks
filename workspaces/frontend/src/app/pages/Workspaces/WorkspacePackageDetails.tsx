import * as React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListDescription,
  ListItem,
  List,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/api/backendApiTypes';
import { WorkspaceFormImageDetails } from './Form/image/WorkspaceFormImageDetails';

interface WorkspacePackageDetailsProps {
  workspace: Workspace;
}

export const WorkspacePackageDetails: React.FC<WorkspacePackageDetailsProps> = ({ workspace }) => {
  // Convert WorkspaceOptionInfo to WorkspacePodConfigValue format
  const imageConfig = workspace.podTemplate.options.imageConfig.current;
  
  // Create enhanced labels array with JupyterLab version if missing
  const enhancedLabels = [...imageConfig.labels];
  
  // Check if JupyterLab version is missing and try to derive it from display name or description
  const hasJupyterLabVersion = imageConfig.labels.some(label => 
    label.key.toLowerCase().includes('jupyterlab') || label.key === 'jupyterlabVersion'
  );
  
  if (!hasJupyterLabVersion) {
    // Try to extract version from display name (e.g., "jupyter-scipy:v1.9.0")
    const versionMatch = imageConfig.displayName.match(/v?(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      enhancedLabels.push({
        key: 'jupyterLab',
        value: versionMatch[1],
      });
    }
  }

  const workspaceImage = {
    ...imageConfig,
    labels: enhancedLabels,
    hidden: false, // Default value since it's not available in WorkspaceOptionInfo
  };

  return (
    <DescriptionList>
      <DescriptionListTerm>Packages</DescriptionListTerm>
      <DescriptionListDescription>
        <List isPlain>
          {workspaceImage.labels.map((label) => (
            <ListItem key={label.key}>
              {label.key}={label.value}
            </ListItem>
          ))}
        </List>
      </DescriptionListDescription>
    </DescriptionList>
  );
};
