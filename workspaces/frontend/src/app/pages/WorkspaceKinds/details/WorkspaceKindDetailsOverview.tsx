import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
  Divider,
  Brand,
} from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';

type WorkspaceDetailsOverviewProps = {
  workspaceKind: WorkspaceKind;
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
      <DescriptionListTerm>Deprecation Message</DescriptionListTerm>
      <DescriptionListDescription>{workspaceKind.deprecationMessage}</DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm style={{ alignSelf: 'center' }}>Icon</DescriptionListTerm>
      <DescriptionListDescription>
        <Brand src={workspaceKind.icon.url} alt={workspaceKind.name} style={{ width: '40px' }} />
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
        <Brand src={workspaceKind.logo.url} alt={workspaceKind.name} style={{ width: '40px' }} />
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
