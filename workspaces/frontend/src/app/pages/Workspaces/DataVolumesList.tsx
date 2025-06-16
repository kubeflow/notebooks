import React from 'react';
import {
  ClipboardCopy,
  ClipboardCopyVariant,
  Content,
  Flex,
  FlexItem,
  List,
  ListItem,
  Stack,
  StackItem,
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
        <Stack>
          <StackItem>
            <Content component="small">
              Mount path:{' '}
              <ClipboardCopy variant={ClipboardCopyVariant.inlineCompact}>
                {data.mountPath}
              </ClipboardCopy>
            </Content>
          </StackItem>
        </Stack>
      </FlexItem>
    </Flex>
  );

  return (
    <Stack hasGutter>
      <StackItem>
        <strong data-testid="notebook-storage-bar-title">Cluster storage</strong>
      </StackItem>
      <StackItem>
        <List isPlain>
          {workspaceDataVol.map((data, index) => (
            <ListItem key={`data-vol-${index}`}>{singleDataVolRenderer(data)}</ListItem>
          ))}
        </List>
      </StackItem>
    </Stack>
  );
};
