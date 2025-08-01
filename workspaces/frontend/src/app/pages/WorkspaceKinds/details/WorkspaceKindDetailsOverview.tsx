import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import ImageFallback from '~/shared/components/ImageFallback';
import WithValidImage from '~/shared/components/WithValidImage';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';

type WorkspaceDetailsOverviewProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
};

export const WorkspaceKindDetailsOverview: React.FunctionComponent<
  WorkspaceDetailsOverviewProps
> = ({ workspaceKind }) => (
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
      <DescriptionListDescription>{workspaceKind.hidden ? 'Yes' : 'No'}</DescriptionListDescription>
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
    <DescriptionListGroup>
      <DescriptionListTerm style={{ alignSelf: 'center' }}>Icon</DescriptionListTerm>
      <DescriptionListDescription>
        <WithValidImage
          imageSrc={workspaceKind.icon.url}
          skeletonWidth="40px"
          fallback={
            <ImageFallback
              imageSrc={workspaceKind.icon.url}
              extended
              message="Cannot load icon image"
            />
          }
        >
          {(validSrc) => <img src={validSrc} alt={workspaceKind.name} style={{ width: '40px' }} />}
        </WithValidImage>
      </DescriptionListDescription>
      <DescriptionListTerm style={{ alignSelf: 'center' }}>Icon URL</DescriptionListTerm>
      <DescriptionListDescription>
        <a href={workspaceKind.icon.url} target="_blank" rel="noreferrer">
          {workspaceKind.icon.url}
        </a>
      </DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm style={{ alignSelf: 'center' }}>Logo</DescriptionListTerm>
      <DescriptionListDescription>
        <WithValidImage
          imageSrc={workspaceKind.logo.url}
          skeletonWidth="40px"
          fallback={
            <ImageFallback
              imageSrc={workspaceKind.logo.url}
              extended
              message="Cannot load logo image"
            />
          }
        >
          {(validSrc) => <img src={validSrc} alt={workspaceKind.name} style={{ width: '40px' }} />}
        </WithValidImage>
      </DescriptionListDescription>
      <DescriptionListTerm style={{ alignSelf: 'center' }}>Logo URL</DescriptionListTerm>
      <DescriptionListDescription>
        <a href={workspaceKind.logo.url} target="_blank" rel="noreferrer">
          {workspaceKind.logo.url}
        </a>
      </DescriptionListDescription>
    </DescriptionListGroup>
  </DescriptionList>
);
