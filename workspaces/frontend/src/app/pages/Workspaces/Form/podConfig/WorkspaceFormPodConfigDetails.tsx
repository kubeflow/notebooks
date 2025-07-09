import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
  Title,
  Divider,
} from '@patternfly/react-core';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';

type WorkspaceFormPodConfigDetailsProps = {
  workspacePodConfig?: WorkspacePodConfigValue;
};

export const WorkspaceFormPodConfigDetails: React.FunctionComponent<
  WorkspaceFormPodConfigDetailsProps
> = ({ workspacePodConfig }) => (
  <>
    {workspacePodConfig && (
      <div style={{ marginLeft: 'var(--pf-t--global--spacer--md)' }}>
        <Title headingLevel="h3">{workspacePodConfig.displayName}</Title>{' '}
        <p>{workspacePodConfig.description}</p>
        <Divider />
        {workspacePodConfig.labels.map((label) => (
          <DescriptionList
            key={label.key}
            isHorizontal
            horizontalTermWidthModifier={{
              default: '12ch',
            }}
          >
            <DescriptionListGroup>
              <DescriptionListTerm>{formatLabelKey(label.key)}</DescriptionListTerm>
              <DescriptionListDescription>{label.value}</DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        ))}
      </div>
    )}
  </>
);
