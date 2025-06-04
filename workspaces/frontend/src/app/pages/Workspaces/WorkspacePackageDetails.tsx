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

const PACKAGE_LABELS: Record<string, string> = {
  jupyterlabVersion: 'JupyterLab',
  pythonVersion: 'Python',
  // Add more mappings here as needed later
};

interface WorkspacePackageDetailsProps {
  workspace: Workspace;
}

export const WorkspacePackageDetails: React.FC<WorkspacePackageDetailsProps> = ({ workspace }) => {
  const { labels } = workspace.podTemplate.options.imageConfig.current;

  const renderedItems = Object.entries(PACKAGE_LABELS).flatMap(([key, label]) => {
    const value = labels.find((l) => l.key === key)?.value;
    return value ? <ListItem key={key}>{`${label} v${value}`}</ListItem> : [];
  });

  return (
    <DescriptionList>
      <DescriptionListGroup>
        <DescriptionListTerm>Packages</DescriptionListTerm>
        <DescriptionListDescription>
          {renderedItems.length > 0 ? (
            <List isPlain>{renderedItems}</List>
          ) : (
            <span>No package information available</span>
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};
