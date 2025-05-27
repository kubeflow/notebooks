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

export const WorkspaceDetailsOverview: React.FunctionComponent<WorkspaceDetailsOverviewProps> = ({
  workspaceKind,
}) => (
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
      <DescriptionListTerm>Hidden </DescriptionListTerm>
      <DescriptionListDescription>{workspaceKind.hidden ? 'Yes' : 'No'}</DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Status</DescriptionListTerm>
      <DescriptionListDescription>
        {workspaceKind.deprecated ? 'Yes' : 'No'}
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
        <img src={workspaceKind.icon.url} alt={workspaceKind.name} style={{ width: '40px' }} />
      </DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm style={{ alignSelf: 'center' }}>logo</DescriptionListTerm>
      <DescriptionListDescription>
        <Brand src={workspaceKind.logo.url} alt={workspaceKind.name} style={{ width: '40px' }} />
      </DescriptionListDescription>
    </DescriptionListGroup>
  </DescriptionList>
);
