import React from 'react';
import {
  ClipboardCopy,
  ClipboardCopyVariant,
  Content,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Flex,
  FlexItem,
  List,
  ListItem,
  Tooltip,
} from '@patternfly/react-core';
import { DatabaseIcon, LockedIcon } from '@patternfly/react-icons';
import { Workspace } from '~/shared/api/backendApiTypes';

interface DataVolumesListProps {
  workspace: Workspace;
}

export const DataVolumesList: React.FC<DataVolumesListProps> = ({ workspace }) => {
  const workspaceDataVol = workspace.podTemplate.volumes.data;

  const singleDataVolRenderer = (data: {
    pvcName: string;
    mountPath: string;
    readOnly: boolean;
  }) => (
    <Flex
      gap={{ default: 'gapSm' }}
      alignItems={{ default: 'alignItemsFlexStart' }}
      flexWrap={{ default: 'nowrap' }}
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
    <DescriptionList>
      <DescriptionListGroup>
        <DescriptionListTerm data-testid="notebook-storage-bar-title">
          Cluster storage
        </DescriptionListTerm>
        <DescriptionListDescription>
          <List isPlain>
            {workspaceDataVol.map((data, index) => (
              <ListItem key={`data-vol-${index}`}>{singleDataVolRenderer(data)}</ListItem>
            ))}
          </List>
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};
