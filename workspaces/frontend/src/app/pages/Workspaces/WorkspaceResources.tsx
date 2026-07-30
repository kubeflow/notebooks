import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { DatabaseIcon } from '@patternfly/react-icons/dist/esm/icons/database-icon';
import { LockedIcon } from '@patternfly/react-icons/dist/esm/icons/locked-icon';
import {
  ClipboardCopy,
  ClipboardCopyVariant,
} from '@patternfly/react-core/dist/esm/components/ClipboardCopy';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { DetailsLoadingState } from '~/app/components/DetailsLoadingState';
import { formatResourceFromWorkspace } from '~/shared/utilities/WorkspaceUtils';
import { DetailsWorkspaceDetails, WorkspacesWorkspaceListItem } from '~/generated/data-contracts';

interface WorkspaceResourcesProps {
  workspace: WorkspacesWorkspaceListItem;
  details: DetailsWorkspaceDetails | null;
  detailsLoaded: boolean;
  detailsError?: Error;
}

export const WorkspaceResources: React.FC<WorkspaceResourcesProps> = ({
  workspace,
  details,
  detailsLoaded,
  detailsError,
}) => {
  const singleDataVolRenderer = (data: {
    pvcName: string;
    mountPath: string;
    readOnly: boolean;
  }) => (
    <Flex
      gap={{ default: 'gapSm' }}
      alignItems={{ default: 'alignItemsFlexStart' }}
      flexWrap={{ default: 'nowrap' }}
      key={data.pvcName}
    >
      <FlexItem>
        <DatabaseIcon />
      </FlexItem>
      <FlexItem>
        <Content>
          {data.pvcName}
          {data.readOnly && (
            <Tooltip content="Data is readonly">
              <LockedIcon style={{ marginLeft: '5px' }} />
            </Tooltip>
          )}
        </Content>
        <Flex gap={{ default: 'gapSm' }} flexWrap={{ default: 'wrap' }}>
          <FlexItem>Mount path:</FlexItem>
          <FlexItem>
            <ClipboardCopy variant={ClipboardCopyVariant.inlineCompact} isCode>
              {data.mountPath}
            </ClipboardCopy>
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  );

  return (
    <DescriptionList isHorizontal>
      <DescriptionListGroup>
        <DescriptionListTerm>CPU</DescriptionListTerm>
        <DescriptionListDescription>
          {formatResourceFromWorkspace(workspace, 'cpu')}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Memory</DescriptionListTerm>
        <DescriptionListDescription>
          {formatResourceFromWorkspace(workspace, 'memory')}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Home volume</DescriptionListTerm>
        <DescriptionListDescription>
          <DetailsLoadingState error={detailsError} loaded={detailsLoaded}>
            {details?.volumes.home.pvcName ?? 'None'}
          </DetailsLoadingState>
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm data-testid="notebook-storage-bar-title">
          Cluster storage
        </DescriptionListTerm>
        <DescriptionListDescription>
          <DetailsLoadingState error={detailsError} loaded={detailsLoaded}>
            <Flex direction={{ default: 'column' }}>
              {(details?.volumes.data ?? []).map((data) => singleDataVolRenderer(data))}
            </Flex>
          </DetailsLoadingState>
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};
