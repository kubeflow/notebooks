import React from 'react';
import {
  DescriptionListTerm,
  DescriptionListDescription,
  DescriptionListGroup,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { extractPackageLabels, formatLabelKey } from '~/shared/utilities/WorkspaceUtils';
import { WorkspacesWorkspaceListItem } from '~/generated/data-contracts';

interface WorkspacePackageDetailsProps {
  workspace: WorkspacesWorkspaceListItem;
}

export const WorkspacePackageDetails: React.FC<WorkspacePackageDetailsProps> = ({ workspace }) => {
  const packageLabels = extractPackageLabels(workspace);

  const renderedItems = packageLabels.map((label) => (
    <Label isCompact key={label.key}>{`${formatLabelKey(label.key)} v${label.value}`}</Label>
  ));

  return (
    <DescriptionListGroup>
      <DescriptionListTerm>Packages</DescriptionListTerm>
      <DescriptionListDescription>
        {renderedItems.length > 0 ? (
          <LabelGroup>{renderedItems}</LabelGroup>
        ) : (
          <span>No package information available</span>
        )}
      </DescriptionListDescription>
    </DescriptionListGroup>
  );
};
