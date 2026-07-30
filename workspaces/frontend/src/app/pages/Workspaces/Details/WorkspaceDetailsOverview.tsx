import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { DetailsWorkspaceDetails, WorkspacesWorkspaceListItem } from '~/generated/data-contracts';
import { DetailsLoadingState } from '~/app/components/DetailsLoadingState';
import { WorkspacePackageDetails } from '~/app/pages/Workspaces/WorkspacePackageDetails';

type WorkspaceDetailsOverviewProps = {
  workspace: WorkspacesWorkspaceListItem;
  details: DetailsWorkspaceDetails | null;
  detailsLoaded: boolean;
  detailsError?: Error;
};

export const WorkspaceDetailsOverview: React.FunctionComponent<WorkspaceDetailsOverviewProps> = ({
  workspace,
  details,
  detailsLoaded,
  detailsError,
}) => (
  <DescriptionList isHorizontal>
    <DescriptionListGroup>
      <DescriptionListTerm>Name</DescriptionListTerm>
      <DescriptionListDescription>{workspace.name}</DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Kind</DescriptionListTerm>
      <DescriptionListDescription>{workspace.workspaceKind.name}</DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Labels</DescriptionListTerm>
      <DescriptionListDescription>
        <DetailsLoadingState error={detailsError} loaded={detailsLoaded}>
          <LabelGroup>
            {Object.entries(details?.podMetadata.labels ?? {}).map(([key, value]) => (
              <Label key={key} isCompact>
                {key}={value}
              </Label>
            ))}
          </LabelGroup>
        </DetailsLoadingState>
      </DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Pod config</DescriptionListTerm>
      <DescriptionListDescription>
        {workspace.podTemplate.options.podConfig.current.displayName}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <WorkspacePackageDetails workspace={workspace} />
    <Divider />
  </DescriptionList>
);
