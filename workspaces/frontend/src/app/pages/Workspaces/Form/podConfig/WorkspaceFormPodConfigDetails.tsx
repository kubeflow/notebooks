import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';
import { WorkspacekindsPodConfigValue } from '~/generated/data-contracts';

type WorkspaceFormPodConfigDetailsProps = {
  workspacePodConfig?: WorkspacekindsPodConfigValue;
};

export const WorkspaceFormPodConfigDetails: React.FunctionComponent<
  WorkspaceFormPodConfigDetailsProps
> = ({ workspacePodConfig }) => (
  <>
    {workspacePodConfig && (
      <>
        <Title headingLevel="h3">{workspacePodConfig.displayName}</Title>{' '}
        <p>{workspacePodConfig.description}</p>
        <br />
        <Divider />
        <br />
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
      </>
    )}
  </>
);
