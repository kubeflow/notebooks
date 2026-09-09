import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Flex } from '@patternfly/react-core/dist/esm/layouts/Flex';
import ImageFallback from '~/shared/components/ImageFallback';
import WorkspaceKindImage from '~/app/components/WorkspaceKindImage';
import { WorkspacekindsWorkspaceKindListItem } from '~/generated/data-contracts';

type WorkspaceDetailsOverviewProps = {
  workspaceKind: WorkspacekindsWorkspaceKindListItem;
};

export const WorkspaceKindDetailsOverview: React.FunctionComponent<
  WorkspaceDetailsOverviewProps
> = ({ workspaceKind }) => (
  <>
    <DescriptionList isHorizontal>
      <DescriptionListGroup>
        <DescriptionListTerm>Name</DescriptionListTerm>
        <DescriptionListDescription>{workspaceKind.name}</DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />

      <DescriptionListGroup>
        <DescriptionListTerm>Description</DescriptionListTerm>
        <DescriptionListDescription>{workspaceKind.description}</DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />

      <DescriptionListGroup>
        <DescriptionListTerm>Hidden</DescriptionListTerm>
        <DescriptionListDescription>
          {workspaceKind.hidden ? 'Yes' : 'No'}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />

      <DescriptionListGroup>
        <DescriptionListTerm>Status</DescriptionListTerm>
        <DescriptionListDescription>
          {workspaceKind.deprecated ? 'Deprecated' : 'Active'}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />

      <DescriptionListGroup>
        <DescriptionListTerm>Deprecation message</DescriptionListTerm>
        <DescriptionListDescription>{workspaceKind.deprecationMessage}</DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
    </DescriptionList>

    <Flex
      justifyContent={{ default: 'justifyContentFlexEnd' }}
      style={{
        paddingBlock: 'var(--pf-t--global--spacer--lg)',
        paddingInlineEnd: 'var(--pf-t--global--spacer--lg)',
      }}
    >
      <WorkspaceKindImage
        imageSrc={workspaceKind.logo.url}
        skeletonWidth="64px"
        fallback={
          <ImageFallback
            imageSrc={workspaceKind.logo.url}
            extended
            message="Cannot load logo image"
          />
        }
        assetType="logo"
        kindName={workspaceKind.name}
      >
        {(validSrc) => (
          <img
            src={validSrc}
            alt={workspaceKind.name}
            style={{
              width: '64px',
              maxHeight: '64px',
              objectFit: 'contain',
            }}
          />
        )}
      </WorkspaceKindImage>
    </Flex>
  </>
);
