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
import { extractPackageLabels, formatLabelKey } from '~/shared/utilities/WorkspaceUtils';

interface WorkspacePackageDetailsProps {
  workspace: Workspace;
}

export const WorkspacePackageDetails: React.FC<WorkspacePackageDetailsProps> = ({ workspace }) => {
  const packageLabels = extractPackageLabels(workspace);

  const renderedItems = packageLabels.map((label) => (
    <ListItem key={label.key}>{`${formatLabelKey(label.key)} v${label.value}`}</ListItem>
  ));

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
