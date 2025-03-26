import React from 'react';
import { Title } from '@patternfly/react-core';
import { WorkspaceImage } from '~/shared/types';

type WorkspaceCreationImageDetailsProps = {
  workspaceImage?: WorkspaceImage;
};

export const WorkspaceCreationImageDetails: React.FunctionComponent<
  WorkspaceCreationImageDetailsProps
> = ({ workspaceImage }) => (
  <>
    {!workspaceImage && <p>Select an image to view its details here.</p>}

    {workspaceImage && (
      <>
        <Title headingLevel="h6">Image</Title>
        <Title headingLevel="h3">{workspaceImage.displayName}</Title>
        {Object.keys(workspaceImage.labels).map((labelKey) => (
          <p key={labelKey}>
            {labelKey}={workspaceImage.labels[labelKey]}
          </p>
        ))}
      </>
    )}
  </>
);
