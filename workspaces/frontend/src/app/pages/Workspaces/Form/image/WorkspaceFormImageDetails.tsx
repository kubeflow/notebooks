import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';
import { OptionsOptionLabel, OptionsPodConfigValue } from '~/generated/data-contracts';

type WorkspaceFormImageDetailsProps = {
  workspaceImage?: OptionsPodConfigValue;
};

export const WorkspaceFormImageDetails: React.FunctionComponent<WorkspaceFormImageDetailsProps> = ({
  workspaceImage,
}) => (
  <>
    {workspaceImage && (
      <>
        <Title headingLevel="h3">{workspaceImage.displayName}</Title>
        <br />
        {(workspaceImage.labels ?? []).map((label: OptionsOptionLabel) => (
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
  </>
);
