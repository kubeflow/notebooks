import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
  Title,
} from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';

type WorkspaceFormImageDetailsProps = {
  workspaceImage?: WorkspacePodConfigValue;
};

export const WorkspaceFormImageDetails: React.FunctionComponent<WorkspaceFormImageDetailsProps> = ({
  workspaceImage,
}) => (
  <div style={{ marginLeft: 'var(--pf-t--global--spacer--md)' }}>
    {workspaceImage && (
      <>
        <Title headingLevel="h3">{workspaceImage.displayName}</Title>
        <br />
        {workspaceImage.labels.map((label) => (
          <DescriptionList
            key={label.key}
            isHorizontal
            isCompact
            horizontalTermWidthModifier={{
              default: '17ch',
            }}
          >
            <DescriptionListGroup>
              <DescriptionListTerm>{formatLabelKey(label.key)}</DescriptionListTerm>
              <DescriptionListDescription>{label.value}</DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        ))}
      </>
    )}
  </div>
);
